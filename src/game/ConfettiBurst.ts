import Phaser from 'phaser'
import { sx, sy, sd } from '../utils/responsive'
import { DEPTH } from '../constants'

const TINTS = [
  0xFF4D8F, 0xFF6B35, 0xFFC83D, 0xFFE45E,
  0x7ED957, 0x4DC3FF, 0xB57BFF, 0xFF8FB1
]

const KEYS = {
  rect:   '__confetti_rect',
  strip:  '__confetti_strip',
  ribbon: '__confetti_ribbon',
  dot:    '__confetti_dot'
} as const

const PIECE_KEYS = [KEYS.rect, KEYS.strip, KEYS.ribbon, KEYS.dot]
const PIECE_WEIGHTS = [0.45, 0.25, 0.20, 0.10]
const DEFAULT_BURST_COUNT = 180
const PARTICLE_LIFE_MS = 6300  // matches max lifespan + small buffer

function ensurePieceTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(KEYS.rect)) return

  {
    const g = scene.add.graphics({ x: 0, y: 0 })
    g.fillStyle(0xFFFFFF, 1)
    g.fillRect(0, 0, 28, 40)
    g.generateTexture(KEYS.rect, 28, 40)
    g.destroy()
  }

  {
    const g = scene.add.graphics({ x: 0, y: 0 })
    g.fillStyle(0xFFFFFF, 1)
    g.fillRect(0, 0, 10, 44)
    g.generateTexture(KEYS.strip, 10, 44)
    g.destroy()
  }

  {
    const W = 56, H = 56
    const g = scene.add.graphics({ x: 0, y: 0 })
    g.fillStyle(0xFFFFFF, 1)
    const cxp = W / 2, cyp = H / 2
    const rOuter = 26, rInner = 18
    const a0 = Phaser.Math.DegToRad(200)
    const a1 = Phaser.Math.DegToRad(340)
    g.beginPath()
    g.arc(cxp, cyp, rOuter, a0, a1, false)
    g.arc(cxp, cyp, rInner, a1, a0, true)
    g.closePath()
    g.fillPath()
    g.generateTexture(KEYS.ribbon, W, H)
    g.destroy()
  }

  {
    const g = scene.add.graphics({ x: 0, y: 0 })
    g.fillStyle(0xFFFFFF, 1)
    g.fillCircle(8, 8, 8)
    g.generateTexture(KEYS.dot, 16, 16)
    g.destroy()
  }
}

export interface ConfettiHandle {
  destroy: () => void
}

export interface ConfettiOptions {
  count?: number
  depth?: number
}

/**
 * Burst confetti from a design-space coord. Particles are radial-upward,
 * gravity-driven, and auto-destroy after ~6s. Returns a handle that lets
 * you tear down early.
 */
export function spawnConfettiBurst(
  scene: Phaser.Scene,
  designX: number,
  designY: number,
  options: ConfettiOptions = {}
): ConfettiHandle {
  ensurePieceTextures(scene)

  const total = options.count ?? DEFAULT_BURST_COUNT
  const depth = options.depth ?? DEPTH.FAIL_WIN + 1

  let lastCx = sx(designX)
  let lastCy = sy(designY)
  const gravity = sd(1400)
  // Initial speed sized so confetti can clear the top of the screen, then fall back.
  const vEdge = Math.sqrt(2 * gravity * Math.max(lastCy, 1))

  const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  for (let i = 0; i < PIECE_KEYS.length; i++) {
    const count = Math.round(total * PIECE_WEIGHTS[i])
    if (count <= 0) continue

    const emitter = scene.add.particles(0, 0, PIECE_KEYS[i], {
      lifespan: { min: 4000, max: 6000 },
      speed:    { min: vEdge * 0.5, max: vEdge * 1.0 },
      angle:    { min: 0, max: 360 },
      gravityY: gravity,
      scale:    { min: sd(1) * 0.6, max: sd(1) * 1.2 },
      rotate:   { min: 0, max: 360 },
      alpha:    { start: 1, end: 0.9 },
      tint:     TINTS,
      blendMode: 'NORMAL',
      emitting:  false
    })
    emitter.setDepth(depth)
    emitter.explode(count, lastCx, lastCy)
    emitters.push(emitter)
  }

  // Particles bake world-space coords + velocities at emit time. On rotation
  // sx/sy shift, leaving the cloud drifting in stale coords. Each frame, slide
  // every alive particle by the center delta so the burst tracks the new
  // viewport. Velocity is left alone — the burst is short-lived, so re-scaling
  // momentum/gravity isn't worth the complexity.
  const onUpdate = (): void => {
    const newCx = sx(designX)
    const newCy = sy(designY)
    const dx = newCx - lastCx
    const dy = newCy - lastCy
    if (dx === 0 && dy === 0) return
    lastCx = newCx
    lastCy = newCy
    for (const e of emitters) {
      e.forEachAlive(p => { p.x += dx; p.y += dy }, undefined)
    }
  }
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate)

  let killed = false
  const handle: ConfettiHandle = {
    destroy: () => {
      if (killed) return
      killed = true
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate)
      for (const e of emitters) e.destroy()
      emitters.length = 0
    }
  }

  scene.time.delayedCall(PARTICLE_LIFE_MS, () => handle.destroy())
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => handle.destroy())
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => handle.destroy())

  return handle
}
