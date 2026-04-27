import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH } from '../constants'
import { sx, sy, sd } from '../utils/responsive'

const LOGO_W = 954.6667
const LOGO_H = 640.6667
const LOGO_X = 540
const LOGO_Y = 720

// CTA — playnow_grn.webp, source 904×332 (aspect ≈ 2.72:1).
const CTA_W = 600
const CTA_H = 220
const CTA_X = 540
const CTA_Y = 1320

// Bounce-in matches IntroLogo intro: 1.5 -> 0.85 -> 1.0.
const BOUNCE_FADE_MS = 250
const BOUNCE_DOWN_MS = 210
const BOUNCE_SETTLE_MS = 260
const CTA_DELAY_AFTER_LOGO = 250

// Idle pulse on the CTA after its bounce-in.
const PULSE_PEAK = 1.08
const PULSE_DURATION = 600

export class EndCard {
  private logo: Phaser.GameObjects.Image
  private cta: Phaser.GameObjects.Image
  private logoMult = 1
  private ctaMult = 1
  private logoActive = false
  private ctaActive = false
  private tapActive = false
  private onTap: (() => void) | null = null

  constructor(private scene: Phaser.Scene) {
    this.logo = scene.add.image(0, 0, TEX.introLogo)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.ENDCARD)
      .setAlpha(0)

    this.cta = scene.add.image(0, 0, TEX.endCardCta)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.ENDCARD)
      .setAlpha(0)

    this.scene.input.on('pointerdown', this.handleSceneTap, this)
  }

  private handleSceneTap(): void {
    if (!this.tapActive) return
    this.onTap?.()
  }

  setOnTap(cb: () => void): void {
    this.onTap = cb
  }

  relayout(): void {
    if (this.logoActive) {
      this.logo.setPosition(sx(LOGO_X), sy(LOGO_Y))
      this.logo.setDisplaySize(sd(LOGO_W * this.logoMult), sd(LOGO_H * this.logoMult))
    }
    if (this.ctaActive) {
      this.cta.setPosition(sx(CTA_X), sy(CTA_Y))
      this.cta.setDisplaySize(sd(CTA_W * this.ctaMult), sd(CTA_H * this.ctaMult))
    }
  }

  play(): void {
    this.logoActive = true
    this.logoMult = 1.5
    this.tapActive = true
    this.relayout()

    this.scene.tweens.add({
      targets: this.logo,
      alpha: 1,
      duration: BOUNCE_FADE_MS,
      ease: 'Sine.easeOut'
    })

    this.bounceMult(
      m => { this.logoMult = m; this.relayout() },
      () => {
        this.scene.time.delayedCall(CTA_DELAY_AFTER_LOGO, () => this.playCta())
      }
    )
  }

  private playCta(): void {
    this.ctaActive = true
    this.ctaMult = 1.5
    this.relayout()

    this.scene.tweens.add({
      targets: this.cta,
      alpha: 1,
      duration: BOUNCE_FADE_MS,
      ease: 'Sine.easeOut'
    })

    this.bounceMult(
      m => { this.ctaMult = m; this.relayout() },
      () => this.startCtaPulse()
    )
  }

  private bounceMult(onUpdate: (m: number) => void, onDone: () => void): void {
    const target = { mult: 1.5 }
    this.scene.tweens.add({
      targets: target,
      mult: 0.85,
      duration: BOUNCE_DOWN_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => onUpdate(target.mult),
      onComplete: () => {
        this.scene.tweens.add({
          targets: target,
          mult: 1,
          duration: BOUNCE_SETTLE_MS,
          ease: 'Back.easeOut',
          onUpdate: () => onUpdate(target.mult),
          onComplete: () => {
            onUpdate(1)
            onDone()
          }
        })
      }
    })
  }

  private startCtaPulse(): void {
    const proxy = { mult: 1 }
    this.scene.tweens.add({
      targets: proxy,
      mult: PULSE_PEAK,
      duration: PULSE_DURATION,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        this.ctaMult = proxy.mult
        this.relayout()
      }
    })
  }
}
