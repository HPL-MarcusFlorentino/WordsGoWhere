import Phaser from 'phaser'
import { AUDIO } from '../assets'

const BGM_VOLUME = 0.225
const SFX_VOLUME = 0.25

export class SoundManager {
  private bgm: Phaser.Sound.BaseSound | null = null
  private bgmStarted = false
  private interacted = false

  constructor(private scene: Phaser.Scene) {
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.scene.input.once('pointerdown', this.onFirstInteraction)
  }

  private onFirstInteraction = (): void => {
    this.interacted = true
    if (this.bgmStarted) return
    this.bgmStarted = true
    try {
      this.bgm = this.scene.sound.add(AUDIO.bgm, { loop: true, volume: BGM_VOLUME })
      this.bgm.play()
    } catch {}
  }

  private safePlay(key: string): void {
    try { this.scene.sound.play(key, { volume: SFX_VOLUME }) } catch {}
  }

  playMerge(): void { this.safePlay(AUDIO.merge) }
  playTileFall(): void { if (this.interacted) this.safePlay(AUDIO.tileFall) }
  playPickUp(): void { this.safePlay(AUDIO.pickUp) }
  playSlotted(): void { this.safePlay(AUDIO.slotted) }
  playWrong(): void { this.safePlay(AUDIO.wrongMerge) }

  private onVisibilityChange = (): void => {
    try {
      this.scene.sound.mute = document.hidden
      const ctx = (this.scene.sound as any).context as AudioContext | undefined
      if (ctx) {
        if (document.hidden) ctx.suspend?.()
        else ctx.resume?.()
      }
    } catch {}
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
  }
}
