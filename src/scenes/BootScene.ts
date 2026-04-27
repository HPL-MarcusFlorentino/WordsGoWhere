import Phaser from 'phaser'
import { ASSETS, TEX, AUDIO, STARBURST_FRAME_COUNT } from '../assets'

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
    this.load.image(TEX.blueMergeTile, ASSETS.blueMergeTile)
    this.load.image(TEX.greenMergeTile, ASSETS.greenMergeTile)
    this.load.image(TEX.blueCategoryTile, ASSETS.blueCategoryTile)
    this.load.image(TEX.greenCategoryTile, ASSETS.greenCategoryTile)
    this.load.image(TEX.selectionGreen, ASSETS.selectionGreen)
    this.load.image(TEX.selectionYellow, ASSETS.selectionYellow)
    this.load.image(TEX.selectionRed, ASSETS.selectionRed)
    this.load.image(TEX.endCardCta, ASSETS.endCardCta)
    this.load.image(TEX.tutorialHand, ASSETS.tutorialHand)
    for (let i = 0; i < STARBURST_FRAME_COUNT; i++) {
      this.load.image(`${TEX.starburst}_${i}`, ASSETS.starburstFrames[i])
    }
    this.load.audio(AUDIO.bgm, ASSETS.bgmSfx)
    this.load.audio(AUDIO.merge, ASSETS.mergeSfx)
    this.load.audio(AUDIO.tileFall, ASSETS.tileFallSfx)
    this.load.audio(AUDIO.pickUp, ASSETS.pickUpSfx)
    this.load.audio(AUDIO.slotted, ASSETS.slottedSfx)
    this.load.audio(AUDIO.wrongMerge, ASSETS.wrongMergeSfx)
  }

  create(): void {
    this.scene.start('Game')
  }
}
