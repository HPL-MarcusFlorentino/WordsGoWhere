import Phaser from 'phaser'
import { TEX, FONT_FAMILY } from '../assets'
import { DEPTH } from '../constants'
import { sx, sy, sd } from '../utils/responsive'

type ImageSpec = { tex: string; x: number; y: number; w: number; h: number }

const CX = 540
const CY = 960

const toDesign = (ux: number, uy: number) => ({ x: CX + ux, y: CY - uy })

export type GameplayTile = {
  container: Phaser.GameObjects.Container
  image: Phaser.GameObjects.Image
  backImage: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  text: string
  stack: number
  layer: 'top' | 'bottom'
  baseDesignX: number
  baseDesignY: number
}

export type SlotInfo = {
  image: Phaser.GameObjects.Image
  designX: number
  designY: number
  row: 1 | 2
}

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

const PURPLE_FRONT_SIZE = { w: 222.3529, h: 167.0588 }
const PURPLE_FRONT_TEXT_FONT_SIZE = 75
const PURPLE_FRONT_TEXT_COLOR = '#3f3f3f'
const PURPLE_FRONT_TEXT_OFFSET_Y = -15

type PurpleFrontSpec = { ux: number; uy: number; text: string; stack: number; layer: 'bottom' | 'top' }
// stack = user's positions 1..6 (1 top, 2 UR, 3 LR, 4 bottom, 5 LL, 6 UL)
// layer = which tile in the 2-tile stack: bottom lands first, top lands on it
const STACK_INTRA_DY = 30
const SIDE_X = 230
const TOP_Y = -250
const UPPER_Y = -360
const LOWER_Y = -510
const BOTTOM_Y = -580
const PURPLE_FRONTS: PurpleFrontSpec[] = [
  // Stack 1 — top center
  { ux:    0, uy: TOP_Y - STACK_INTRA_DY,    text: 'LE',   stack: 1, layer: 'bottom' },
  { ux:    0, uy: TOP_Y,                     text: 'BOW',  stack: 1, layer: 'top'    },
  // Stack 4 — bottom center
  { ux:    0, uy: BOTTOM_Y - STACK_INTRA_DY, text: 'ANGE', stack: 4, layer: 'bottom' },
  { ux:    0, uy: BOTTOM_Y,                  text: 'SU',   stack: 4, layer: 'top'    },
  // Stack 6 — upper-left
  { ux: -SIDE_X, uy: UPPER_Y - STACK_INTRA_DY, text: 'APP',  stack: 6, layer: 'bottom' },
  { ux: -SIDE_X, uy: UPPER_Y,                  text: 'RAIN', stack: 6, layer: 'top'    },
  // Stack 2 — upper-right
  { ux:  SIDE_X, uy: UPPER_Y - STACK_INTRA_DY, text: 'OR',   stack: 2, layer: 'bottom' },
  { ux:  SIDE_X, uy: UPPER_Y,                  text: 'N',    stack: 2, layer: 'top'    },
  // Stack 5 — lower-left
  { ux: -SIDE_X, uy: LOWER_Y - STACK_INTRA_DY, text: 'UD',   stack: 5, layer: 'bottom' },
  { ux: -SIDE_X, uy: LOWER_Y,                  text: 'MAN',  stack: 5, layer: 'top'    },
  // Stack 3 — lower-right
  { ux:  SIDE_X, uy: LOWER_Y - STACK_INTRA_DY, text: 'CLO',  stack: 3, layer: 'bottom' },
  { ux:  SIDE_X, uy: LOWER_Y,                  text: 'GO',   stack: 3, layer: 'top'    }
]

// Falling order: bottom of board first, cycling through stacks
const FALL_STACK_ORDER = [4, 5, 3, 6, 2, 1]
const FALL_START_DESIGN_Y = 960       // mid-screen in design coords (CY)
const FALL_DURATION = 380             // ms per tile fall
// Last tile (stack 1 top / BOW) must land when bottom slot row finishes (t = 940 ms).
// 12 tiles → 11 inter-tile gaps must fit in (940 - FALL_DURATION) = 560 ms.
const FALL_LAST_LANDING_MS = 940
const FALL_STAGGER_INTER = (FALL_LAST_LANDING_MS - FALL_DURATION) / 11
const SQUASH_DURATION = 110           // ms to squash
const SQUASH_X = 1.18
const SQUASH_Y = 0.78
const FALL_START_SCALE = 1.6          // tiles start bigger (closer to camera), shrink to 1 on landing

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
  private purpleFronts: Array<{
    container: Phaser.GameObjects.Container
    image: Phaser.GameObjects.Image
    backImage: Phaser.GameObjects.Image
    label: Phaser.GameObjects.Text
    spec: PurpleFrontSpec
    animY: number      // additive design-y offset (negative = above rest)
    scaleX: number     // additional scale on top of relayout sizing
    scaleY: number
  }> = []
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

    for (const spec of PURPLE_FRONTS) {
      const container = scene.add.container(0, 0)
      const faceUp = spec.text === 'RAIN' || spec.text === 'BOW'
      const backImage = scene.add.image(0, 0, TEX.purpleBackTile).setOrigin(0.5, 0.5).setVisible(!faceUp)
      const image = scene.add.image(0, 0, TEX.purpleFrontTile).setOrigin(0.5, 0.5).setVisible(faceUp)
      const label = scene.add.text(0, 0, spec.text, {
        fontFamily: FONT_FAMILY,
        fontSize: `${PURPLE_FRONT_TEXT_FONT_SIZE}px`,
        color: PURPLE_FRONT_TEXT_COLOR
      }).setOrigin(0.5, 0.5).setVisible(faceUp)
      container.add([backImage, image, label])
      this.root.add(container)
      this.purpleFronts.push({ container, image, backImage, label, spec, animY: 0, scaleX: 1, scaleY: 1 })
    }

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

    for (const entry of this.purpleFronts) {
      const { container, image, backImage, label, spec, animY, scaleX, scaleY } = entry
      const p = toDesign(spec.ux, spec.uy)
      container.setPosition(sx(p.x), sy(p.y + animY))
      image.setDisplaySize(sd(PURPLE_FRONT_SIZE.w) * scaleX, sd(PURPLE_FRONT_SIZE.h) * scaleY)
      backImage.setDisplaySize(sd(PURPLE_FRONT_SIZE.w) * scaleX, sd(PURPLE_FRONT_SIZE.h) * scaleY)
      label.setPosition(0, sd(PURPLE_FRONT_TEXT_OFFSET_Y) * scaleY)
      label.setFontSize(sd(PURPLE_FRONT_TEXT_FONT_SIZE) * Math.min(scaleX, scaleY))
    }
  }

  getTiles(): GameplayTile[] {
    return this.purpleFronts.map(e => ({
      container: e.container,
      image: e.image,
      backImage: e.backImage,
      label: e.label,
      text: e.spec.text,
      stack: e.spec.stack,
      layer: e.spec.layer,
      baseDesignX: toDesign(e.spec.ux, e.spec.uy).x,
      baseDesignY: toDesign(e.spec.ux, e.spec.uy).y
    }))
  }

  getTileSize(): { w: number; h: number } {
    return { w: PURPLE_FRONT_SIZE.w, h: PURPLE_FRONT_SIZE.h }
  }

  getRoot(): Phaser.GameObjects.Container {
    return this.root
  }

  getSlots(): SlotInfo[] {
    const result: SlotInfo[] = []
    // Design brief: order is row1 (top), row2 (bottom). Row1 has slots 1,2,3; row2 has 4,5,6
    // TILE_SLOTS_ROW1 is the row at uy=445 (upper), TILE_SLOTS_ROW2 at uy=235 (lower)
    for (let i = 0; i < this.row1Slots.length; i++) {
      const s = TILE_SLOTS_ROW1[i]
      const p = toDesign(s.ux, s.uy)
      result.push({ image: this.row1Slots[i], designX: p.x, designY: p.y, row: 1 })
    }
    for (let i = 0; i < this.row2Slots.length; i++) {
      const s = TILE_SLOTS_ROW2[i]
      const p = toDesign(s.ux, s.uy)
      result.push({ image: this.row2Slots[i], designX: p.x, designY: p.y, row: 2 })
    }
    return result
  }

  getTileContainerCenter(): { x: number; y: number; w: number; h: number } {
    return { x: TILE_CONTAINER.x, y: TILE_CONTAINER.y, w: TILE_CONTAINER.w, h: TILE_CONTAINER.h }
  }

  private animateTileFall(entry: GameplayLayout['purpleFronts'][number], delay: number): void {
    const restY = toDesign(entry.spec.ux, entry.spec.uy).y
    entry.animY = FALL_START_DESIGN_Y - restY
    entry.container.setAlpha(0)
    this.scene.tweens.add({
      targets: entry.container,
      alpha: 1,
      duration: FALL_DURATION,
      delay,
      ease: 'Sine.easeOut'
    })
    const fallProxy = { d: entry.animY, s: FALL_START_SCALE }
    entry.scaleX = FALL_START_SCALE
    entry.scaleY = FALL_START_SCALE
    this.scene.tweens.add({
      targets: fallProxy,
      d: 0,
      s: 1,
      duration: FALL_DURATION,
      delay,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        entry.animY = fallProxy.d
        entry.scaleX = fallProxy.s
        entry.scaleY = fallProxy.s
        this.relayout()
      },
      onComplete: () => {
        // Squash on impact, then return to rest
        const sq = { x: 1, y: 1 }
        this.scene.tweens.add({
          targets: sq,
          x: SQUASH_X,
          y: SQUASH_Y,
          duration: SQUASH_DURATION,
          ease: 'Quad.easeOut',
          onUpdate: () => { entry.scaleX = sq.x; entry.scaleY = sq.y; this.relayout() },
          onComplete: () => {
            this.scene.tweens.add({
              targets: sq,
              x: 1,
              y: 1,
              duration: SQUASH_DURATION * 1.4,
              ease: 'Back.easeOut',
              easeParams: [2.0],
              onUpdate: () => { entry.scaleX = sq.x; entry.scaleY = sq.y; this.relayout() }
            })
          }
        })
      }
    })
  }

  playFalling(startDelay = 0): void {
    // Initialize all tiles off-screen and invisible until their turn
    for (const entry of this.purpleFronts) {
      const restY = toDesign(entry.spec.ux, entry.spec.uy).y
      entry.animY = FALL_START_DESIGN_Y - restY
      entry.scaleX = 1
      entry.scaleY = 1
      entry.container.setAlpha(0)
    }
    this.relayout()

    let cursor = startDelay

    // Pass 1: every stack's bottom tile, in order 4 -> 5 -> 3 -> 6 -> 2 -> 1
    for (const stackId of FALL_STACK_ORDER) {
      const bottom = this.purpleFronts.find(e => e.spec.stack === stackId && e.spec.layer === 'bottom')!
      this.animateTileFall(bottom, cursor)
      cursor += FALL_STAGGER_INTER
    }

    // Pass 2: every stack's top tile, same stack order (uniform gap from last bottom)
    for (const stackId of FALL_STACK_ORDER) {
      const top = this.purpleFronts.find(e => e.spec.stack === stackId && e.spec.layer === 'top')!
      this.animateTileFall(top, cursor)
      cursor += FALL_STAGGER_INTER
    }
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

    // Phase 4 (starts t=0 with Moves rise): tiles fall into the container, bottom stack first
    this.playFalling(0)
  }
}
