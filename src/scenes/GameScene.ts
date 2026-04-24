import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH } from '../constants'
import { viewW, viewH } from '../utils/responsive'
import { IntroLogo } from '../game/IntroLogo'
import { GameplayLayout } from '../game/GameplayLayout'
import { TileInteraction } from '../game/TileInteraction'

const BG_REF = 2000

export class GameScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image
  private introLogo!: IntroLogo
  private gameplay!: GameplayLayout
  private interaction!: TileInteraction

  constructor() { super('Game') }

  create(): void {
    this.bg = this.add.image(0, 0, TEX.background)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.BG)

    this.gameplay = new GameplayLayout(this)
    this.introLogo = new IntroLogo(this)
    this.interaction = new TileInteraction(this, this.gameplay)

    this.relayout()
    this.introLogo.play(undefined, () => {
      this.gameplay.fadeIn(400)
      this.time.delayedCall(1200, () => this.interaction.enable())
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
  }
}
