import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { recomputeResponsive } from './utils/responsive'
import { initMraid, bindLifecycle, notifyGameReady } from './networks'

;(window as any).gameReady  ??= () => {}
;(window as any).gameStart  ??= () => {}
;(window as any).gameEnd    ??= () => {}
;(window as any).gameClose  ??= () => {}

let game: Phaser.Game | null = null

function currentViewport(): { w: number; h: number } {
  const vv = (window as any).visualViewport as VisualViewport | undefined
  const w = vv ? vv.width  : window.innerWidth
  const h = vv ? vv.height : window.innerHeight
  return { w, h }
}

function sizeGame(): void {
  if (!game) return
  const { w, h } = currentViewport()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  recomputeResponsive(w * dpr, h * dpr)
  game.scale.resize(w * dpr, h * dpr)
  for (const scene of game.scene.getScenes(true)) {
    const relayout = (scene as any).relayout
    if (typeof relayout === 'function') relayout.call(scene)
  }
  const canvas = game.canvas
  if (canvas) {
    canvas.style.width  = w + 'px'
    canvas.style.height = h + 'px'
  }
}

function bindResponsiveResize(): void {
  let raf = 0
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(sizeGame)
  }
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
  ;(window as any).visualViewport?.addEventListener('resize', schedule)
  setTimeout(sizeGame, 100)
  setTimeout(sizeGame, 300)
  setTimeout(sizeGame, 600)
}

function startGame(): void {
  const { w, h } = currentViewport()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  recomputeResponsive(w * dpr, h * dpr)

  const parent = document.createElement('div')
  parent.id = 'game'
  parent.style.cssText = 'position:fixed;inset:0;'
  document.body.appendChild(parent)

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    scale: { mode: Phaser.Scale.NONE, width: w * dpr, height: h * dpr },
    render: { antialias: true, pixelArt: false },
    scene: [BootScene, GameScene]
  })

  if (game.canvas) {
    game.canvas.style.width  = w + 'px'
    game.canvas.style.height = h + 'px'
  }

  bindResponsiveResize()
  bindLifecycle(
    () => { try { if (game) game.sound.mute = true  } catch {} },
    () => { try { if (game) game.sound.mute = false } catch {} }
  )
  notifyGameReady()
}

function boot(): void {
  const fontReady = Promise.race([
    (document as any).fonts?.ready ?? Promise.resolve(),
    new Promise((r) => setTimeout(r, 1500))
  ])
  Promise.all([initMraid(), fontReady]).then(startGame).catch(startGame)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
