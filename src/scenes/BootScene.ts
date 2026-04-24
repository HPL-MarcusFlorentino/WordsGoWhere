import Phaser from 'phaser'
import { ASSETS, TEX } from '../assets'

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }

  preload(): void {
    this.load.image(TEX.background, ASSETS.background)
    this.load.image(TEX.introLogo, ASSETS.introLogo)
    this.load.image(TEX.levelCounter, ASSETS.levelCounter)
    this.load.image(TEX.movesContainer, ASSETS.movesContainer)
    this.load.image(TEX.tileSlot, ASSETS.tileSlot)
    this.load.image(TEX.tileContainer, ASSETS.tileContainer)
    this.load.image(TEX.purpleBackTile, ASSETS.purpleBackTile)
    this.load.image(TEX.purpleFrontTile, ASSETS.purpleFrontTile)
    this.load.image(TEX.mergedTile, ASSETS.mergedTile)
  }

  create(): void {
    this.scene.start('Game')
  }
}
