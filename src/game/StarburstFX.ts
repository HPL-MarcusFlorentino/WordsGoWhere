import Phaser from 'phaser'
import { TEX, STARBURST_FRAME_COUNT, STARBURST_SOURCE_INDICES } from '../assets'
import { sx, sy, sd } from '../utils/responsive'

const ANIM_KEY = 'starburst_play'
const SOURCE_FPS = 30
const FRAME_TAIL_GAP = 2  // last frame: assume same gap as the duplicated tail (48 was paired)
// Speed multiplier on per-frame duration. <1 = faster than source. The source
// 30 fps timing felt sluggish, so play roughly 1.8× faster.
const SPEED_MULTIPLIER = 0.55

// Source frames are 1080x1920 design canvas; encoded WebPs are cropped to the
// shared union bbox below. We render the sprite at design-space size matching
// the bbox, so the sprite's pixel center aligns with the original canvas center
// when placed at MERGE_ANCHOR_DESIGN_X/Y.
const FRAME_BBOX_W = 988
const FRAME_BBOX_H = 1068
// On-screen scale relative to the source bbox. Lowering this shrinks the
// displayed VFX without re-encoding the textures. Anchor offsets scale with it
// so the artist's intended origin (source canvas center) always lands on the
// placement coord.
const DISPLAY_SCALE = 0.75
const FRAME_DESIGN_W = FRAME_BBOX_W * DISPLAY_SCALE
const FRAME_DESIGN_H = FRAME_BBOX_H * DISPLAY_SCALE
// Bbox in source canvas: (33, 456) to (1021, 1524). The source canvas center
// is (540, 960); the bbox center is (527, 990). Offset = (canvas - bbox).
const ANCHOR_OFFSET_X = ((1080 / 2) - (33 + FRAME_BBOX_W / 2)) * DISPLAY_SCALE   // ~10
const ANCHOR_OFFSET_Y = ((1920 / 2) - (456 + FRAME_BBOX_H / 2)) * DISPLAY_SCALE  // ~-22

let animEnsured = false

function ensureAnim(scene: Phaser.Scene): void {
  if (animEnsured) return
  if (scene.anims.exists(ANIM_KEY)) { animEnsured = true; return }

  const frames: Phaser.Types.Animations.AnimationFrame[] = []
  for (let i = 0; i < STARBURST_FRAME_COUNT; i++) {
    const cur = STARBURST_SOURCE_INDICES[i]
    const next = i + 1 < STARBURST_FRAME_COUNT ? STARBURST_SOURCE_INDICES[i + 1] : cur + FRAME_TAIL_GAP
    const gap = next - cur  // how many source frames this output frame represents
    const duration = (gap / SOURCE_FPS) * 1000 * SPEED_MULTIPLIER
    frames.push({ key: `${TEX.starburst}_${i}`, duration })
  }

  scene.anims.create({
    key: ANIM_KEY,
    frames,
    repeat: 0
  })
  animEnsured = true
}

export interface StarburstHandle {
  sprite: Phaser.GameObjects.Sprite
  destroy: () => void
}

/**
 * Create a starburst sprite at the given design-space coords.
 * loop=true plays continuously (preview); loop=false plays once and destroys.
 */
export function spawnStarburst(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  designX: number,
  designY: number,
  loop = false
): StarburstHandle {
  ensureAnim(scene)

  const px = sx(designX + ANCHOR_OFFSET_X)
  const py = sy(designY + ANCHOR_OFFSET_Y)
  const sprite = scene.add.sprite(px, py, `${TEX.starburst}_0`).setOrigin(0.5, 0.5)
  sprite.setDisplaySize(sd(FRAME_DESIGN_W), sd(FRAME_DESIGN_H))
  sprite.setBlendMode(Phaser.BlendModes.ADD)
  parent.add(sprite)
  parent.bringToTop(sprite)

  let killed = false
  const handle: StarburstHandle = {
    sprite,
    destroy: () => {
      if (killed) return
      killed = true
      sprite.destroy()
    }
  }

  const playOnce = () => sprite.play(ANIM_KEY)
  playOnce()

  if (loop) {
    sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!killed) playOnce()
    })
  } else {
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => handle.destroy())
  }

  return handle
}

