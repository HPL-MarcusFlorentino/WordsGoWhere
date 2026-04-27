import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH } from '../constants'
import { sx, sy, sd } from '../utils/responsive'

const HAND_DESIGN_W = 260
const HAND_DESIGN_H = 260
const HAND_ORIGIN_X = 0.28
const HAND_ORIGIN_Y = 0.25

const FADE_IN_MS = 320
const PRESS_MS = 220
const PRESS_HOLD_MS = 90
const MOVE_MS = 720
const RELEASE_MS = 220
const RELEASE_HOLD_MS = 80
const FADE_OUT_MS = 280
const LOOP_GAP_MS = 380

const SCALE_REST = 1
const SCALE_PRESS = 0.78

type Pt = { x: number; y: number }

type HandState = {
  designX: number
  designY: number
  scale: number
  alpha: number
}

export class TutorialHand {
  private image: Phaser.GameObjects.Image
  private state: HandState = { designX: 0, designY: 0, scale: SCALE_REST, alpha: 0 }
  private active = false
  private from: Pt = { x: 0, y: 0 }
  private to: Pt = { x: 0, y: 0 }

  constructor(private scene: Phaser.Scene) {
    this.image = scene.add.image(0, 0, TEX.tutorialHand)
      .setOrigin(HAND_ORIGIN_X, HAND_ORIGIN_Y)
      .setDepth(DEPTH.TUTORIAL)
      .setVisible(false)
  }

  relayout(): void {
    this.image.setPosition(sx(this.state.designX), sy(this.state.designY))
    this.image.setDisplaySize(sd(HAND_DESIGN_W) * this.state.scale, sd(HAND_DESIGN_H) * this.state.scale)
    this.image.setAlpha(this.state.alpha)
  }

  start(from: Pt, to: Pt): void {
    if (this.active) return
    this.scene.tweens.killTweensOf(this.state)
    this.from = { x: from.x, y: from.y }
    this.to = { x: to.x, y: to.y }
    this.active = true
    this.image.setVisible(true)
    this.runLoop()
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    this.scene.tweens.killTweensOf(this.state)
    this.scene.tweens.add({
      targets: this.state,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onUpdate: () => this.relayout(),
      onComplete: () => this.image.setVisible(false)
    })
  }

  private runLoop(): void {
    if (!this.active) return
    this.state.designX = this.from.x
    this.state.designY = this.from.y
    this.state.scale = SCALE_REST
    this.state.alpha = 0
    this.relayout()

    this.scene.tweens.add({
      targets: this.state,
      alpha: 1,
      duration: FADE_IN_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => this.relayout(),
      onComplete: () => this.pressDown()
    })
  }

  private pressDown(): void {
    if (!this.active) return
    this.scene.tweens.add({
      targets: this.state,
      scale: SCALE_PRESS,
      duration: PRESS_MS,
      ease: 'Sine.easeIn',
      onUpdate: () => this.relayout(),
      onComplete: () => {
        if (!this.active) return
        this.scene.time.delayedCall(PRESS_HOLD_MS, () => this.moveToTarget())
      }
    })
  }

  private moveToTarget(): void {
    if (!this.active) return
    this.scene.tweens.add({
      targets: this.state,
      designX: this.to.x,
      designY: this.to.y,
      duration: MOVE_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.relayout(),
      onComplete: () => this.releaseUp()
    })
  }

  private releaseUp(): void {
    if (!this.active) return
    this.scene.tweens.add({
      targets: this.state,
      scale: SCALE_REST,
      duration: RELEASE_MS,
      ease: 'Back.easeOut',
      easeParams: [1.6],
      onUpdate: () => this.relayout(),
      onComplete: () => {
        if (!this.active) return
        this.scene.time.delayedCall(RELEASE_HOLD_MS, () => this.fadeOut())
      }
    })
  }

  private fadeOut(): void {
    if (!this.active) return
    this.scene.tweens.add({
      targets: this.state,
      alpha: 0,
      duration: FADE_OUT_MS,
      ease: 'Sine.easeIn',
      onUpdate: () => this.relayout(),
      onComplete: () => {
        if (!this.active) return
        this.scene.time.delayedCall(LOOP_GAP_MS, () => this.runLoop())
      }
    })
  }
}
