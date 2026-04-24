import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH } from '../constants'
import { sx, sy, sd } from '../utils/responsive'

const LOGO_W = 954.6667
const LOGO_H = 640.6667
const LOGO_X = 540
const LOGO_Y = 960

export class IntroLogo {
  private image: Phaser.GameObjects.Image
  private sizeMult = 1

  constructor(private scene: Phaser.Scene) {
    this.image = scene.add.image(0, 0, TEX.introLogo)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.LOGO)
      .setAlpha(0)
  }

  relayout(): void {
    this.image.setPosition(sx(LOGO_X), sy(LOGO_Y))
    this.image.setDisplaySize(sd(LOGO_W * this.sizeMult), sd(LOGO_H * this.sizeMult))
  }

  play(onComplete?: () => void, onOutroStart?: () => void): void {
    // Start oversized at 1.5x, invisible
    const target = { mult: 1.5 }
    this.sizeMult = target.mult
    this.relayout()

    // Fade in
    this.scene.tweens.add({
      targets: this.image,
      alpha: 1,
      duration: 250,
      ease: 'Sine.easeOut'
    })

    // Bounce-in: 1.5 -> 0.85 (undershoot)
    this.scene.tweens.add({
      targets: target,
      mult: { value: 0.85, duration: 210, ease: 'Sine.easeInOut' },
      onUpdate: () => {
        this.sizeMult = target.mult
        this.relayout()
      },
      onComplete: () => {
        // Settle: 0.85 -> 1.0
        this.scene.tweens.add({
          targets: target,
          mult: 1,
          duration: 260,
          ease: 'Back.easeOut',
          onUpdate: () => {
            this.sizeMult = target.mult
            this.relayout()
          },
          onComplete: () => {
            this.sizeMult = 1
            this.relayout()
            this.playOutro(onComplete, onOutroStart)
          }
        })
      }
    })
  }

  private playOutro(onComplete?: () => void, onOutroStart?: () => void): void {
    const target = { mult: 1 }

    onOutroStart?.()

    // Outro phase 1: scale 1.0 -> 1.25 while alpha 1.0 -> 0.5
    this.scene.tweens.add({
      targets: target,
      mult: 1.25,
      duration: 200,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.sizeMult = target.mult
        this.relayout()
      },
      onComplete: () => {
        // Outro phase 2: scale 1.25 -> 0.75 (shrink out)
        this.scene.tweens.add({
          targets: target,
          mult: 0.75,
          duration: 250,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            this.sizeMult = target.mult
            this.relayout()
          },
          onComplete: () => {
            onComplete?.()
          }
        })
      }
    })

    // Alpha track (parallel): 1.0 -> 0.5 -> 0, reaches 0 as scale hits 0.75
    this.scene.tweens.add({
      targets: this.image,
      alpha: 0.5,
      duration: 200,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this.image,
          alpha: 0,
          duration: 250,
          ease: 'Sine.easeIn'
        })
      }
    })
  }
}
