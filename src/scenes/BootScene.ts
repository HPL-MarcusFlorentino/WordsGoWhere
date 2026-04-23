import Phaser from 'phaser'
import { ASSETS, TEX } from '../assets'

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot') }

  preload(): void {
    this.load.image(TEX.bgBlue, ASSETS.bgBlue)
    this.load.image(TEX.bgBluepurp, ASSETS.bgBluepurp)
  }

  create(): void {
    this.scene.start('Game')
  }
}
