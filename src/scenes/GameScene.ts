import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH } from '../constants'
import { viewW, viewH } from '../utils/responsive'
import { IntroLogo } from '../game/IntroLogo'
import { GameplayLayout } from '../game/GameplayLayout'
import { TileInteraction } from '../game/TileInteraction'
import { EndCard } from '../game/EndCard'
import { SoundManager } from '../game/SoundManager'
import { TutorialHand } from '../game/TutorialHand'
import { trackEvent } from '../analytics'
import { triggerCTA } from '../networks'

const BG_REF = 2000

const PHASE1_TUTORIAL_REPEAT_DELAY_MS = 5000
const PHASE2_TUTORIAL_INITIAL_DELAY_MS = 7000
const PHASE2_TUTORIAL_REPEAT_DELAY_MS = 5000

export class GameScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image
  private introLogo!: IntroLogo
  private gameplay!: GameplayLayout
  private interaction!: TileInteraction
  private endCard!: EndCard
  private sound_!: SoundManager
  private tutorial!: TutorialHand
  private phase1TutorialTimer: Phaser.Time.TimerEvent | null = null
  private phase2TutorialTimer: Phaser.Time.TimerEvent | null = null

  constructor() { super('Game') }

  create(): void {
    this.bg = this.add.image(0, 0, TEX.background)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.BG)

    this.sound_ = new SoundManager(this)
    this.gameplay = new GameplayLayout(this, this.sound_)
    this.introLogo = new IntroLogo(this)
    this.interaction = new TileInteraction(this, this.gameplay, this.sound_)
    this.endCard = new EndCard(this, this.sound_)
    this.tutorial = new TutorialHand(this)

    this.interaction.setOnPhase1Solved(() => {
      trackEvent('CHALLENGE_SOLVED')
      this.cancelPhase1Tutorial()
    })
    this.interaction.setOnPhase2Started(() => {
      trackEvent('CHALLENGE_STARTED')
      this.schedulePhase2Tutorial(PHASE2_TUTORIAL_INITIAL_DELAY_MS)
    })
    this.interaction.setOnPhaseFailed(() => this.handleFail())
    this.interaction.setOnWin(() => this.handleWin())
    this.interaction.setOnPhase1Interaction(() => this.onPhase1Activity())
    this.interaction.setOnPhase2Interaction(() => this.onPhase2Activity())
    this.endCard.setOnTap(() => {
      trackEvent('CTA_CLICKED')
      triggerCTA()
    })

    this.relayout()
    this.introLogo.play(undefined, () => {
      this.gameplay.fadeIn(400)
      this.time.delayedCall(1200, () => {
        trackEvent('CHALLENGE_STARTED')
        this.interaction.enable()
        this.startPhase1Tutorial()
      })
    })
  }

  private startPhase1Tutorial(): void {
    const pair = this.interaction.getPhase1TutorialPair()
    if (pair) this.tutorial.start(pair.from, pair.to)
  }

  private schedulePhase1Tutorial(delayMs: number): void {
    this.phase1TutorialTimer?.remove()
    this.phase1TutorialTimer = this.time.delayedCall(delayMs, () => {
      this.phase1TutorialTimer = null
      this.startPhase1Tutorial()
    })
  }

  private onPhase1Activity(): void {
    this.phase1TutorialTimer?.remove()
    this.phase1TutorialTimer = null
    this.tutorial.stop()
    this.schedulePhase1Tutorial(PHASE1_TUTORIAL_REPEAT_DELAY_MS)
  }

  private cancelPhase1Tutorial(): void {
    this.phase1TutorialTimer?.remove()
    this.phase1TutorialTimer = null
    this.tutorial.stop()
  }

  private schedulePhase2Tutorial(delayMs: number): void {
    this.phase2TutorialTimer?.remove()
    this.phase2TutorialTimer = this.time.delayedCall(delayMs, () => {
      this.phase2TutorialTimer = null
      const pair = this.interaction.getPhase2TutorialPair()
      if (pair) this.tutorial.start(pair.from, pair.to)
    })
  }

  private onPhase2Activity(): void {
    this.phase2TutorialTimer?.remove()
    this.phase2TutorialTimer = null
    this.tutorial.stop()
    this.schedulePhase2Tutorial(PHASE2_TUTORIAL_REPEAT_DELAY_MS)
  }

  private cancelPhase2Tutorial(): void {
    this.phase2TutorialTimer?.remove()
    this.phase2TutorialTimer = null
    this.tutorial.stop()
  }

  private handleWin(): void {
    trackEvent('CHALLENGE_SOLVED')
    this.cancelPhase2Tutorial()
    this.gameplay.fadeOut(500, () => {
      trackEvent('ENDCARD_SHOWN')
      this.endCard.play()
    })
  }

  private handleFail(): void {
    trackEvent('CHALLENGE_FAILED')
    trackEvent('CTA_CLICKED')
    triggerCTA()
    this.cancelPhase1Tutorial()
    this.cancelPhase2Tutorial()
    this.gameplay.fadeOut(500, () => {
      trackEvent('ENDCARD_SHOWN')
      this.endCard.play()
    })
  }

  relayout(): void {
    const vw = viewW()
    const vh = viewH()

    const bgCover = Math.max(vw / BG_REF, vh / BG_REF)
    this.bg.setPosition(vw / 2, vh / 2)
    this.bg.setDisplaySize(BG_REF * bgCover, BG_REF * bgCover)

    this.gameplay.relayout()
    this.introLogo.relayout()
    if (this.interaction) this.interaction.relayout()
    if (this.endCard) this.endCard.relayout()
    if (this.tutorial) this.tutorial.relayout()
  }
}
