import Phaser from 'phaser'
import { TEX, FONT_FAMILY } from '../assets'
import { DEPTH } from '../constants'
import { sx, sy, sd } from '../utils/responsive'

type ImageSpec = { tex: string; x: number; y: number; w: number; h: number }

const CX = 540
const CY = 960

const toDesign = (ux: number, uy: number) => ({ x: CX + ux, y: CY - uy })

const MOVES_CONTAINER: ImageSpec = { tex: TEX.movesContainer, ...toDesign(0, 664), w: 173.6, h: 152.8 }
const LEVEL_COUNTER_SIZE = { w: 153.6, h: 34.4 }
const LEVEL_COUNTER_LOCAL_Y = -111
const TILE_CONTAINER: ImageSpec = { tex: TEX.tileContainer, ...toDesign(0, -425), w: 888.6667, h: 564.6667 }

const TILE_SLOT_SIZE = { w: 300, h: 163 }
const TILE_SLOTS_ROW1: Array<{ ux: number; uy: number }> = [
  { ux: -310, uy: 445 },
  { ux:    0, uy: 445 },
  { ux:  310, uy: 445 }
]
const TILE_SLOTS_ROW2: Array<{ ux: number; uy: number }> = [
  { ux: -310, uy: 235 },
  { ux:    0, uy: 235 },
  { ux:  310, uy: 235 }
]

const PURPLE_BACK_SIZE = { w: 257.3334, h: 195.3333 }
const PURPLE_BACKS: Array<{ ux: number; uy: number }> = [
  { ux:    0, uy: -280 },
  { ux:    0, uy: -580 },
  { ux: -245, uy: -366 },
  { ux:  245, uy: -366 },
  { ux: -245, uy: -525 },
  { ux:  245, uy: -525 }
]

const PURPLE_FRONT_SMALL: ImageSpec = {
  tex: TEX.purpleFrontTile,
  ...toDesign(0, -498.8),
  w: 252,
  h: 189.3333
}

const MERGED_TILE: ImageSpec = {
  tex: TEX.mergedTile,
  ...toDesign(0, 0),
  w: 308,
  h: 172
}

const MERGED_TEXT = 'BREAD'
const MERGED_TEXT_FONT_SIZE = 55
const MERGED_TEXT_COLOR = '#3e3e3e'
const MERGED_TEXT_OFFSET_Y = -15

const MOVES_LABEL = 'Moves'
const MOVES_COUNT = '8'
const MOVES_LABEL_FONT_SIZE = 36
const MOVES_COUNT_FONT_SIZE = 85
const MOVES_LABEL_LOCAL_Y = -44
const MOVES_COUNT_LOCAL_Y = 18

const MOVES_ANIM_START_Y = 620
const MOVES_ANIM_REST_Y = MOVES_CONTAINER.y

export class GameplayLayout {
  private root: Phaser.GameObjects.Container
  private images: Array<{ obj: Phaser.GameObjects.Image; spec: ImageSpec }> = []
  private mergedTile!: Phaser.GameObjects.Container
  private mergedTileImage!: Phaser.GameObjects.Image
  private mergedLabel!: Phaser.GameObjects.Text
  private movesGroup!: Phaser.GameObjects.Container
  private movesBg!: Phaser.GameObjects.Image
  private movesLabel!: Phaser.GameObjects.Text
  private movesCount!: Phaser.GameObjects.Text
  private levelCounter!: Phaser.GameObjects.Image
  private movesDesignY = MOVES_ANIM_START_Y
  private row1Slots: Phaser.GameObjects.Image[] = []
  private row2Slots: Phaser.GameObjects.Image[] = []
  private row1Mult = 0
  private row2Mult = 0

  constructor(private scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(DEPTH.GAME).setAlpha(0)

    this.movesGroup = scene.add.container(0, 0)
    this.movesBg = scene.add.image(0, 0, MOVES_CONTAINER.tex).setOrigin(0.5, 0.5)
    this.levelCounter = scene.add.image(0, 0, TEX.levelCounter).setOrigin(0.5, 0.5)
    this.movesLabel = scene.add.text(0, 0, MOVES_LABEL, {
      fontFamily: FONT_FAMILY,
      fontSize: `${MOVES_LABEL_FONT_SIZE}px`,
      color: '#ffffff'
    }).setOrigin(0.5, 0.5)
    this.movesCount = scene.add.text(0, 0, MOVES_COUNT, {
      fontFamily: FONT_FAMILY,
      fontSize: `${MOVES_COUNT_FONT_SIZE}px`,
      color: '#ffffff'
    }).setOrigin(0.5, 0.5)
    this.movesGroup.add([this.movesBg, this.movesLabel, this.movesCount, this.levelCounter])
    this.root.add(this.movesGroup)

    for (const slot of TILE_SLOTS_ROW1) {
      const p = toDesign(slot.ux, slot.uy)
      const { obj } = this.addImage({ tex: TEX.tileSlot, x: p.x, y: p.y, w: TILE_SLOT_SIZE.w, h: TILE_SLOT_SIZE.h })
      obj.setScale(0)
      this.row1Slots.push(obj)
    }
    for (const slot of TILE_SLOTS_ROW2) {
      const p = toDesign(slot.ux, slot.uy)
      const { obj } = this.addImage({ tex: TEX.tileSlot, x: p.x, y: p.y, w: TILE_SLOT_SIZE.w, h: TILE_SLOT_SIZE.h })
      obj.setScale(0)
      this.row2Slots.push(obj)
    }

    this.addImage(TILE_CONTAINER)

    for (const back of PURPLE_BACKS) {
      const p = toDesign(back.ux, back.uy)
      this.addImage({ tex: TEX.purpleBackTile, x: p.x, y: p.y, w: PURPLE_BACK_SIZE.w, h: PURPLE_BACK_SIZE.h })
    }

    this.addImage(PURPLE_FRONT_SMALL).obj.setVisible(false)

    this.mergedTile = scene.add.container(0, 0)
    this.mergedTileImage = scene.add.image(0, 0, MERGED_TILE.tex).setOrigin(0.5, 0.5)
    this.mergedLabel = scene.add.text(0, 0, MERGED_TEXT, {
      fontFamily: FONT_FAMILY,
      fontSize: `${MERGED_TEXT_FONT_SIZE}px`,
      color: MERGED_TEXT_COLOR
    }).setOrigin(0.5, 0.5)
    this.mergedTile.add([this.mergedTileImage, this.mergedLabel])
    this.root.add(this.mergedTile)

  }

  private addImage(spec: ImageSpec) {
    const obj = this.scene.add.image(0, 0, spec.tex).setOrigin(0.5, 0.5)
    this.root.add(obj)
    this.images.push({ obj, spec })
    return { obj }
  }

  relayout(): void {
    for (const { obj, spec } of this.images) {
      obj.setPosition(sx(spec.x), sy(spec.y))
      obj.setDisplaySize(sd(spec.w), sd(spec.h))
    }
    for (const s of this.row1Slots) { s.scaleX *= this.row1Mult; s.scaleY *= this.row1Mult }
    for (const s of this.row2Slots) { s.scaleX *= this.row2Mult; s.scaleY *= this.row2Mult }

    this.movesGroup.setPosition(sx(MOVES_CONTAINER.x), sy(this.movesDesignY))
    this.movesBg.setDisplaySize(sd(MOVES_CONTAINER.w), sd(MOVES_CONTAINER.h))
    this.movesLabel.setPosition(0, sd(MOVES_LABEL_LOCAL_Y))
    this.movesLabel.setFontSize(sd(MOVES_LABEL_FONT_SIZE))
    this.movesCount.setPosition(0, sd(MOVES_COUNT_LOCAL_Y))
    this.movesCount.setFontSize(sd(MOVES_COUNT_FONT_SIZE))
    this.levelCounter.setPosition(0, sd(LEVEL_COUNTER_LOCAL_Y))
    this.levelCounter.setDisplaySize(sd(LEVEL_COUNTER_SIZE.w), sd(LEVEL_COUNTER_SIZE.h))

    this.mergedTile.setPosition(sx(MERGED_TILE.x), sy(MERGED_TILE.y))
    this.mergedTileImage.setDisplaySize(sd(MERGED_TILE.w), sd(MERGED_TILE.h))
    this.mergedLabel.setPosition(0, sd(MERGED_TEXT_OFFSET_Y))
    this.mergedLabel.setFontSize(sd(MERGED_TEXT_FONT_SIZE))
  }

  fadeIn(duration = 400): void {
    // Phase 0 (t=0..400ms): whole scene alpha 0 -> 1
    this.scene.tweens.add({
      targets: this.root,
      alpha: 1,
      duration,
      ease: 'Sine.easeOut'
    })

    // Reset animated state to starting values
    this.movesDesignY = MOVES_ANIM_START_Y
    this.row1Mult = 0
    this.row2Mult = 0
    this.movesGroup.setAlpha(0.5)

    // Phase 1 (t=0..750ms): Moves container rises from mid-grid to rest with Back overshoot
    const proxy = { y: MOVES_ANIM_START_Y }
    this.scene.tweens.add({
      targets: proxy,
      y: MOVES_ANIM_REST_Y,
      duration: 750,
      ease: 'Back.easeOut',
      easeParams: [1.5],
      onUpdate: () => {
        this.movesDesignY = proxy.y
        this.relayout()
      }
    })
    // Phase 1 alpha (parallel): Moves alpha 0.5 -> 1 across the rise
    this.scene.tweens.add({
      targets: this.movesGroup,
      alpha: 1,
      duration: 750,
      ease: 'Sine.easeOut'
    })

    // Phase 2 (t=375..695ms): Row 1 slots scale 0 -> 1 w/ overshoot (begins at Moves' 50%)
    const r1 = { s: 0 }
    this.scene.tweens.add({
      targets: r1,
      s: 1,
      duration: 320,
      delay: 375,
      ease: 'Back.easeOut',
      easeParams: [2.4],
      onUpdate: () => { this.row1Mult = r1.s; this.relayout() }
    })

    // Phase 3 (t=620..940ms): Row 2 slots scale 0 -> 1 w/ overshoot (begins as Moves descends)
    const r2 = { s: 0 }
    this.scene.tweens.add({
      targets: r2,
      s: 1,
      duration: 320,
      delay: 620,
      ease: 'Back.easeOut',
      easeParams: [2.4],
      onUpdate: () => { this.row2Mult = r2.s; this.relayout() }
    })
  }
}
