import Phaser from 'phaser'
import { TEX, FONT_FAMILY } from '../assets'
import { sx, sy, sd, unsx, unsy } from '../utils/responsive'
import type { GameplayLayout, GameplayTile, SlotInfo } from './GameplayLayout'

const VALID_WORDS = ['RAINBOW', 'SUN', 'CLOUD', 'APPLE', 'MANGO', 'ORANGE']

const GLOW_SIZE = { w: 232, h: 180 }
const GLOW_OFFSET_Y = -4.5
const MERGED_TILE_SIZE = { w: 300, h: 163 }
const MERGED_TEXT_FONT_SIZE = 64
const MERGED_TEXT_COLOR = '#3f3f3f'
const MERGED_TEXT_OFFSET_Y = -6

const RED_FLASH_DURATION = 260
const MERGE_SPREAD_DURATION = 220
const MERGE_CLASH_DURATION = 180
const MERGE_SQUISH_SHOW = 120
const MERGE_STRETCH = 260
const MERGE_SETTLE = 160
const CTOSLOT_DURATION = 520
const SLOT_LAND_SQUASH = 140

// Impact-scale sequence for the merged tile appearing at the anchor:
// starts horizontally squished (side-impact), stretches wide, settles to 1.
const MERGE_IMPACT_SCALE_X = 0.45
const MERGE_IMPACT_SCALE_Y = 1.15
const MERGE_STRETCH_SCALE_X = 1.25
const MERGE_STRETCH_SCALE_Y = 0.88

// Fixed positions in design coords — every merge uses these regardless of
// which two tiles were combined.
const TILE1_DESIGN_X = 220   // left tile spread position (red)
const TILE1_DESIGN_Y = 950
const TILE2_DESIGN_X = 860   // right tile spread position (blue)
const TILE2_DESIGN_Y = 950
const MERGE_ANCHOR_DESIGN_X = 540  // merge point (green)
const MERGE_ANCHOR_DESIGN_Y = 850

// Debug crosshairs for adjusting the three fixed points above.
const DEBUG_MERGE_PATHS = true

const FLIP_DOWN_DURATION = 140
const FLIP_UP_DURATION = 160
const FLIP_JUMP_HEIGHT = 70

type DragState = {
  tile: GameplayTile
  pointerStartX: number
  pointerStartY: number
  tileStartX: number
  tileStartY: number
  glow: Phaser.GameObjects.Image
  hoverTarget: GameplayTile | null
  hoverGlow: Phaser.GameObjects.Image | null
  originalIndex: number
}

// Tile mid-merge — position tracked in design coords so resize reprojects it.
type MergingTile = {
  container: Phaser.GameObjects.Container
  designX: number
  designY: number
}

// Merged visual (post-clash) — stores design-space geometry so relayout reapplies cleanly.
type MergedVisual = {
  container: Phaser.GameObjects.Container
  img: Phaser.GameObjects.Image
  label: Phaser.GameObjects.Text
  designX: number
  designY: number
  designW: number
  designH: number
  fontSize: number
  textOffsetY: number
}

export class TileInteraction {
  private tiles: GameplayTile[] = []
  private slots: SlotInfo[] = []
  private occupiedSlots = new Set<number>()
  private drag: DragState | null = null
  private mergeInProgress = false
  private faceUp = new Set<GameplayTile>()
  private topsRevealed = false
  private debugGfx: Phaser.GameObjects.Graphics | null = null
  private mergingTiles: MergingTile[] = []
  private mergedVisuals: MergedVisual[] = []

  constructor(private scene: Phaser.Scene, private layout: GameplayLayout) {}

  relayout(): void {
    for (const mt of this.mergingTiles) {
      mt.container.setPosition(sx(mt.designX), sy(mt.designY))
    }
    for (const mv of this.mergedVisuals) this.applyMergedVisual(mv)
    this.redrawDebug()
  }

  private applyMergedVisual(mv: MergedVisual): void {
    mv.container.setPosition(sx(mv.designX), sy(mv.designY))
    mv.img.setDisplaySize(sd(mv.designW), sd(mv.designH))
    mv.label.setPosition(0, sd(mv.textOffsetY))
    mv.label.setFontSize(sd(mv.fontSize))
  }

  enable(): void {
    this.tiles = this.layout.getTiles()
    this.slots = this.layout.getSlots()

    this.applyInitialFaceState()

    for (const tile of this.tiles) {
      this.applyHitArea(tile)
      tile.image.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(tile, p))
      tile.backImage.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(tile, p))
    }

    this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p))
    this.scene.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p))
    this.scene.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onPointerUp(p))

    if (DEBUG_MERGE_PATHS) this.initDebugGfx()
  }

  private initDebugGfx(): void {
    this.debugGfx = this.scene.add.graphics()
    this.layout.getRoot().add(this.debugGfx)
    this.layout.getRoot().bringToTop(this.debugGfx)
    this.redrawDebug()
  }

  private drawCrosshair(x: number, y: number, color: number): void {
    if (!this.debugGfx) return
    const g = this.debugGfx
    g.lineStyle(sd(3), color, 0.9)
    g.strokeCircle(x, y, sd(18))
    g.lineBetween(x - sd(28), y, x + sd(28), y)
    g.lineBetween(x, y - sd(28), x, y + sd(28))
  }

  private redrawDebug(): void {
    if (!this.debugGfx) return
    this.debugGfx.clear()
    this.drawCrosshair(sx(TILE1_DESIGN_X), sy(TILE1_DESIGN_Y), 0xff3030)         // red — tile 1 spread dest
    this.drawCrosshair(sx(TILE2_DESIGN_X), sy(TILE2_DESIGN_Y), 0x30a0ff)         // blue — tile 2 spread dest
    this.drawCrosshair(sx(MERGE_ANCHOR_DESIGN_X), sy(MERGE_ANCHOR_DESIGN_Y), 0x00ff00)  // green — merge point
  }

  private applyHitArea(tile: GameplayTile): void {
    // Default hit area = texture source bounds centered by image origin (0.5).
    // Phaser composes current world transform (including setDisplaySize scaling and
    // parent container position) on every hit test — no need to refresh on resize.
    if (!tile.image.input) tile.image.setInteractive()
    if (!tile.backImage.input) tile.backImage.setInteractive()
  }

  private isTopBlocked(tile: GameplayTile): boolean {
    if (tile.layer === 'top') return false
    return this.tiles.some(t => t.stack === tile.stack && t.layer === 'top' && t.container.active && t.container.visible)
  }

  private applyInitialFaceState(): void {
    // Tiles are created face-down at rest — only RAIN and BOW start face-up.
    this.faceUp.clear()
    for (const tile of this.tiles) {
      if (tile.text === 'RAIN' || tile.text === 'BOW') this.faceUp.add(tile)
    }
  }

  private applyFaceState(): void {
    for (const tile of this.tiles) {
      if (!tile.container.active || !tile.container.visible) continue
      const up = this.faceUp.has(tile)
      tile.image.setVisible(up)
      tile.label.setVisible(up)
      tile.backImage.setVisible(!up)
    }
  }

  private flipToFaceUp(tile: GameplayTile, delay = 0): void {
    if (this.faceUp.has(tile)) return
    const proxy = { s: 1 }
    const restY = tile.container.y
    const apexY = restY - sd(FLIP_JUMP_HEIGHT)

    this.scene.tweens.add({
      targets: proxy,
      s: 0,
      duration: FLIP_DOWN_DURATION,
      delay,
      ease: 'Sine.easeIn',
      onUpdate: () => { tile.container.scaleY = proxy.s },
      onComplete: () => {
        this.faceUp.add(tile)
        this.applyFaceState()
        this.scene.tweens.add({
          targets: proxy,
          s: 1,
          duration: FLIP_UP_DURATION,
          ease: 'Sine.easeOut',
          onUpdate: () => { tile.container.scaleY = proxy.s }
        })
      }
    })

    this.scene.tweens.add({
      targets: tile.container,
      y: apexY,
      duration: FLIP_DOWN_DURATION,
      delay,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: tile.container,
          y: restY,
          duration: FLIP_UP_DURATION,
          ease: 'Sine.easeIn'
        })
      }
    })
  }

  private revealAllTops(): void {
    if (this.topsRevealed) return
    this.topsRevealed = true
    for (const tile of this.tiles) {
      if (tile.layer !== 'top') continue
      if (this.faceUp.has(tile)) continue
      if (!tile.container.active || !tile.container.visible) continue
      this.flipToFaceUp(tile)
    }
  }

  private onPointerDown(tile: GameplayTile, p: Phaser.Input.Pointer): void {
    if (this.mergeInProgress) return
    if (this.drag) return
    if (this.isTopBlocked(tile)) return
    if (!tile.container.visible) return
    if (!this.faceUp.has(tile)) return

    const root = this.layout.getRoot()
    const originalIndex = root.getIndex(tile.container)

    const glow = this.scene.add.image(tile.container.x, tile.container.y + sd(GLOW_OFFSET_Y), TEX.selectionGreen)
      .setOrigin(0.5, 0.5)
      .setDepth(tile.container.depth + 1)
    glow.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
    root.add(glow)
    root.bringToTop(tile.container)

    this.drag = {
      tile,
      pointerStartX: p.x,
      pointerStartY: p.y,
      tileStartX: tile.container.x,
      tileStartY: tile.container.y,
      glow,
      hoverTarget: null,
      hoverGlow: null,
      originalIndex
    }
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!this.drag) return
    const d = this.drag
    const dx = p.x - d.pointerStartX
    const dy = p.y - d.pointerStartY
    d.tile.container.setPosition(d.tileStartX + dx, d.tileStartY + dy)
    d.glow.setPosition(d.tile.container.x, d.tile.container.y + sd(GLOW_OFFSET_Y))

    const target = this.findHoverTarget(p.x, p.y)
    if (target !== d.hoverTarget) {
      if (d.hoverGlow) { d.hoverGlow.destroy(); d.hoverGlow = null }
      d.hoverTarget = target
      if (target) {
        const root = this.layout.getRoot()
        const g = this.scene.add.image(target.container.x, target.container.y + sd(GLOW_OFFSET_Y), TEX.selectionYellow)
          .setOrigin(0.5, 0.5)
          .setDepth(target.container.depth + 1)
        g.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
        root.add(g)
        root.bringToTop(d.tile.container)
        d.hoverGlow = g
      }
    }
  }

  private findHoverTarget(px: number, py: number): GameplayTile | null {
    if (!this.drag) return null
    const dragged = this.drag.tile
    const size = this.layout.getTileSize()
    const halfW = sd(size.w) / 2
    const halfH = sd(size.h) / 2
    for (const tile of this.tiles) {
      if (tile === dragged) continue
      if (!tile.container.active || !tile.container.visible) continue
      if (this.isTopBlocked(tile)) continue
      if (!this.faceUp.has(tile)) continue
      const cx = tile.container.x
      const cy = tile.container.y
      if (px >= cx - halfW && px <= cx + halfW && py >= cy - halfH && py <= cy + halfH) {
        return tile
      }
    }
    return null
  }

  private onPointerUp(_p: Phaser.Input.Pointer): void {
    if (!this.drag) return
    const d = this.drag
    d.glow.destroy()
    if (d.hoverGlow) d.hoverGlow.destroy()

    const target = d.hoverTarget
    const originalIndex = d.originalIndex
    this.drag = null

    if (target) {
      const wordA = d.tile.text + target.text
      const wordB = target.text + d.tile.text
      const validFirst = VALID_WORDS.includes(wordA)
      const validSecond = VALID_WORDS.includes(wordB)
      if (validFirst || validSecond) {
        const word = validFirst ? wordA : wordB
        const left = validFirst ? d.tile : target
        const right = validFirst ? target : d.tile
        this.doMerge(left, right, word)
        return
      }
      this.flashRed(d.tile, target)
    }
    this.layout.getRoot().moveTo(d.tile.container, originalIndex)
    this.returnToRest(d.tile)
  }

  private flashRed(a: GameplayTile, b: GameplayTile): void {
    const mkGlow = (t: GameplayTile) => {
      const g = this.scene.add.image(t.container.x, t.container.y + sd(GLOW_OFFSET_Y), TEX.selectionRed)
        .setOrigin(0.5, 0.5)
        .setDepth(t.container.depth + 1)
      g.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
      this.layout.getRoot().add(g)
      return g
    }
    const ga = mkGlow(a)
    const gb = mkGlow(b)
    this.scene.tweens.add({
      targets: [ga, gb],
      alpha: 0,
      duration: RED_FLASH_DURATION,
      ease: 'Sine.easeOut',
      onComplete: () => { ga.destroy(); gb.destroy() }
    })
  }

  private returnToRest(tile: GameplayTile): void {
    const targetX = sx(tile.baseDesignX)
    const targetY = sy(tile.baseDesignY)
    this.scene.tweens.add({
      targets: tile.container,
      x: targetX,
      y: targetY,
      duration: 180,
      ease: 'Sine.easeOut'
    })
  }

  private doMerge(left: GameplayTile, right: GameplayTile, word: string): void {
    this.mergeInProgress = true

    // Capture start positions in design coords so rotation mid-merge reprojects cleanly.
    const leftStartDX = unsx(left.container.x)
    const leftStartDY = unsy(left.container.y)
    const rightStartDX = unsx(right.container.x)
    const rightStartDY = unsy(right.container.y)

    const mtLeft: MergingTile = { container: left.container, designX: leftStartDX, designY: leftStartDY }
    const mtRight: MergingTile = { container: right.container, designX: rightStartDX, designY: rightStartDY }
    this.mergingTiles.push(mtLeft, mtRight)

    // Phase 1: tiles move to their fixed spread positions in design space.
    this.tweenMergingTo(mtLeft, TILE1_DESIGN_X, TILE1_DESIGN_Y, MERGE_SPREAD_DURATION, 'Quad.easeOut')
    this.tweenMergingTo(mtRight, TILE2_DESIGN_X, TILE2_DESIGN_Y, MERGE_SPREAD_DURATION, 'Quad.easeOut', () => {
      // Phase 2: both converge at the fixed merge anchor.
      this.tweenMergingTo(mtLeft, MERGE_ANCHOR_DESIGN_X, MERGE_ANCHOR_DESIGN_Y, MERGE_CLASH_DURATION, 'Quad.easeIn')
      this.tweenMergingTo(mtRight, MERGE_ANCHOR_DESIGN_X, MERGE_ANCHOR_DESIGN_Y, MERGE_CLASH_DURATION, 'Quad.easeIn', () => {
        left.container.setVisible(false)
        right.container.setVisible(false)
        this.removeMergingTile(mtLeft)
        this.removeMergingTile(mtRight)
        this.faceUp.delete(left)
        this.faceUp.delete(right)
        this.onTilesRemoved([left, right], word)
        this.spawnMergedAndStretch(word)
      })
    })
  }

  private tweenMergingTo(
    mt: MergingTile,
    toDX: number,
    toDY: number,
    duration: number,
    ease: string,
    onComplete?: () => void
  ): void {
    const proxy = { x: mt.designX, y: mt.designY }
    this.scene.tweens.add({
      targets: proxy,
      x: toDX,
      y: toDY,
      duration,
      ease,
      onUpdate: () => {
        mt.designX = proxy.x
        mt.designY = proxy.y
        mt.container.setPosition(sx(proxy.x), sy(proxy.y))
      },
      onComplete
    })
  }

  private spawnMergedAndStretch(word: string): void {
    const container = this.scene.add.container(sx(MERGE_ANCHOR_DESIGN_X), sy(MERGE_ANCHOR_DESIGN_Y))
    const img = this.scene.add.image(0, 0, TEX.mergedTile).setOrigin(0.5, 0.5)
    img.setDisplaySize(sd(MERGED_TILE_SIZE.w), sd(MERGED_TILE_SIZE.h))
    const label = this.scene.add.text(0, sd(MERGED_TEXT_OFFSET_Y), word, {
      fontFamily: FONT_FAMILY,
      fontSize: `${sd(MERGED_TEXT_FONT_SIZE)}px`,
      color: MERGED_TEXT_COLOR
    }).setOrigin(0.5, 0.5)
    container.add([img, label])
    this.layout.getRoot().add(container)
    this.layout.getRoot().bringToTop(container)

    const mv: MergedVisual = {
      container, img, label,
      designX: MERGE_ANCHOR_DESIGN_X,
      designY: MERGE_ANCHOR_DESIGN_Y,
      designW: MERGED_TILE_SIZE.w,
      designH: MERGED_TILE_SIZE.h,
      fontSize: MERGED_TEXT_FONT_SIZE,
      textOffsetY: MERGED_TEXT_OFFSET_Y
    }
    this.mergedVisuals.push(mv)

    // Impact frame: horizontally squished to show the two tiles colliding from the sides.
    container.setScale(MERGE_IMPACT_SCALE_X, MERGE_IMPACT_SCALE_Y)
    this.scene.tweens.add({
      targets: container,
      scaleX: MERGE_STRETCH_SCALE_X,
      scaleY: MERGE_STRETCH_SCALE_Y,
      duration: MERGE_STRETCH,
      delay: MERGE_SQUISH_SHOW,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: MERGE_SETTLE,
          ease: 'Back.easeOut',
          easeParams: [1.5],
          onComplete: () => this.flyToSlot(mv)
        })
      }
    })
  }

  private flyToSlot(mv: MergedVisual): void {
    const slotIndex = this.nextSlotIndex()
    if (slotIndex < 0) {
      this.mergeInProgress = false
      return
    }
    this.occupiedSlots.add(slotIndex)
    const slot = this.slots[slotIndex]
    const startDX = mv.designX
    const startDY = mv.designY
    const endDX = slot.designX
    const endDY = slot.designY
    // Control point offset is a design-space distance — stays constant across orientations.
    const ctrlDX = (startDX + endDX) / 2 - 260
    const ctrlDY = (startDY + endDY) / 2

    const proxy = { t: 0 }
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: CTOSLOT_DURATION,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = proxy.t
        const omt = 1 - t
        const dx = omt * omt * startDX + 2 * omt * t * ctrlDX + t * t * endDX
        const dy = omt * omt * startDY + 2 * omt * t * ctrlDY + t * t * endDY
        mv.designX = dx
        mv.designY = dy
        mv.container.setPosition(sx(dx), sy(dy))
      },
      onComplete: () => {
        mv.designX = endDX
        mv.designY = endDY
        this.scene.tweens.add({
          targets: mv.container,
          scaleX: 0.75,
          scaleY: 0.75,
          duration: SLOT_LAND_SQUASH,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.scene.tweens.add({
              targets: mv.container,
              scaleX: 1,
              scaleY: 1,
              duration: SLOT_LAND_SQUASH,
              ease: 'Back.easeOut',
              easeParams: [2],
              onComplete: () => { this.mergeInProgress = false }
            })
          }
        })
      }
    })
  }

  private removeMergingTile(mt: MergingTile): void {
    const i = this.mergingTiles.indexOf(mt)
    if (i >= 0) this.mergingTiles.splice(i, 1)
  }

  private onTilesRemoved(removed: GameplayTile[], word: string): void {
    // Any bottom tile whose top was removed now flips face-up.
    for (const r of removed) {
      if (r.layer !== 'top') continue
      const bottom = this.tiles.find(t => t.stack === r.stack && t.layer === 'bottom' && t.container.visible)
      if (bottom) this.flipToFaceUp(bottom)
    }
    // After RAINBOW merge, reveal every remaining top tile.
    if (word === 'RAINBOW') this.revealAllTops()
    this.applyFaceState()
  }

  private nextSlotIndex(): number {
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.occupiedSlots.has(i)) return i
    }
    return -1
  }
}
