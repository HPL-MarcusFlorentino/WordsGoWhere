import Phaser from 'phaser'
import { TEX } from '../assets'
import { DEPTH, DESIGN_WIDTH, DESIGN_HEIGHT } from '../constants'
import { sx, sy, sd, viewW, viewH } from '../utils/responsive'

export class GameScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image
  private testParent!: Phaser.GameObjects.Image
  private testChild!: Phaser.GameObjects.Image

  constructor() { super('Game') }

  create(): void {
    this.bg = this.add.image(0, 0, TEX.bgBlue)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.BG)

    this.testParent = this.add.image(0, 0, TEX.bgBluepurp)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.GAME)

    this.testChild = this.add.image(0, 0, TEX.bgBluepurp)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH.GAME + 1)

    this.relayout()
  }

  relayout(): void {
    const vw = viewW()
    const vh = viewH()

    const bgCover = Math.max(vw / 2000, vh / 2000)
    this.bg.setPosition(vw / 2, vh / 2)
    this.bg.setDisplaySize(2000 * bgCover, 2000 * bgCover)

    this.testParent.setPosition(sx(DESIGN_WIDTH / 2), sy(DESIGN_HEIGHT / 2))
    this.testParent.setDisplaySize(sd(500), sd(500))

    this.testChild.setPosition(sx(DESIGN_WIDTH / 2), sy(DESIGN_HEIGHT / 2))
    this.testChild.setDisplaySize(sd(250), sd(250))
  }
}
