import Phaser from 'phaser'
import { TEX, FONT_FAMILY } from '../assets'
import { sx, sy, sd, unsx, unsy } from '../utils/responsive'
import type { GameplayLayout, GameplayTile, SlotInfo } from './GameplayLayout'
import type { SoundManager } from './SoundManager'
import { spawnStarburst } from './StarburstFX'
import { spawnConfettiBurst } from './ConfettiBurst'
import { DESIGN_WIDTH } from '../constants'

const VALID_WORDS = ['RAINBOW', 'SUN', 'CLOUD', 'APPLE', 'MANGO', 'ORANGE']

const CATEGORY_SKY = new Set(['RAINBOW', 'CLOUD', 'SUN'])
const CATEGORY_FRUITS = new Set(['ORANGE', 'APPLE', 'MANGO'])

const PHASE2_SWAP_DURATION = 280
const PHASE2_RETURN_DURATION = 180
const SNAKE_PER_TILE_DURATION = 260   // up + down ms per tile (yoyo'd)
const SNAKE_STAGGER = 140
const SNAKE_SCALE_PEAK = 1.25

// Category bar that appears after the row's snake animation, anchored on the
// row's left edge, and stretches rightward covering the full row.
const CATEGORY_BAR_DESIGN_W = 960
const CATEGORY_BAR_DESIGN_H = 170
const CATEGORY_BAR_LEFT_DX = 60              // design-x of bar's left edge (origin 0, 0.5)
const CATEGORY_BAR_START_SCALE_X_MULT = 0.05 // fraction of full width at spawn
const CATEGORY_BAR_DURATION = 620
const CATEGORY_JUMP_HEIGHT = 35      // design px peak displacement during jump
const CATEGORY_JUMP_UP_DURATION = 200
const CATEGORY_JUMP_DOWN_DURATION = 220
const WIN_AFTER_CONFETTI_DELAY = 1200
const CATEGORY_TITLE_FONT_SIZE = 62
const CATEGORY_WORDS_FONT_SIZE = 32
const CATEGORY_TITLE_COLOR = '#ffffff'
const CATEGORY_WORDS_COLOR = '#c8cdd6'   // slightly cooler/dimmer than pure white
// Offsets from the bar's geometric center. The bar art has a drop shadow
// on the bottom, so the visual center of the button face sits above geometric
// center — both text offsets are nudged upward to compensate.
const CATEGORY_TITLE_OFFSET_Y = -42
const CATEGORY_WORDS_OFFSET_Y = 20

const GLOW_SIZE = { w: 232, h: 180 }
const GLOW_OFFSET_Y = -4.5
const HOVER_TEXT_COLOR = '#FFD645'
const TILE_TEXT_COLOR = '#3f3f3f'
const MERGED_TILE_SIZE = { w: 300, h: 163 }
const MERGED_TEXT_FONT_SIZE = 64
const MERGED_TEXT_MAX_WIDTH = 240  // design px — shrink font if label exceeds this
const MERGED_TEXT_COLOR = '#3f3f3f'
const MERGED_TEXT_OFFSET_Y = -12

const SHAKE_DURATION = 450
const SHAKE_AMPLITUDE = 18   // design px peak displacement
const SHAKE_CYCLES = 3.5     // half-oscillations end at 0 when 3.5 full cycles
const MERGE_SPREAD_DURATION = 220
const MERGE_CLASH_DURATION = 180
const MERGE_SQUISH_SHOW = 70
const MERGE_STRETCH = 150
const MERGE_SETTLE = 100
const CTOSLOT_DURATION = 320
const SLOT_LAND_SQUASH = 90

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
  slotIndex: number
  word: string
  locked: boolean
}

type Phase2Drag = {
  mv: MergedVisual
  pointerStartX: number
  pointerStartY: number
  containerStartX: number
  containerStartY: number
  hoverTarget: MergedVisual | null
}

// Category-bar state — everything is stored in design space so relayout()
// can re-project cleanly after an orientation flip. `s` is the current tween
// progress (CATEGORY_BAR_START_SCALE_X_MULT..1) and drives both the bar's
// horizontal growth and the accompanying text scale.
type CategoryBar = {
  bar: Phaser.GameObjects.Image
  title: Phaser.GameObjects.Text
  words: Phaser.GameObjects.Text
  rowDesignY: number
  s: number
  jumpDY: number
  tiles: MergedVisual[]
}

export class TileInteraction {
  private tiles: GameplayTile[] = []
  private slots: SlotInfo[] = []
  private occupiedSlots = new Set<number>()
  private drag: DragState | null = null
  private mergeInProgress = false
  private faceUp = new Set<GameplayTile>()
  private topsRevealed = false
  private mergingTiles: MergingTile[] = []
  private mergedVisuals: MergedVisual[] = []
  private phase2Enabled = false
  private phase2Swapping = false
  private phase2Drag: Phase2Drag | null = null
  private categoryBars: CategoryBar[] = []
  private pendingCategoryBars = 0
  private completedBarDesignYs: number[] = []
  private winFired = false
  private failFired = false
  private onWin: (() => void) | null = null
  private onPhase1Solved: (() => void) | null = null
  private onPhase2Started: (() => void) | null = null
  private onPhaseFailed: (() => void) | null = null
  private onPhase1Interaction: (() => void) | null = null
  private onPhase2Interaction: (() => void) | null = null

  constructor(private scene: Phaser.Scene, private layout: GameplayLayout, private sound: SoundManager) {}

  setOnWin(cb: () => void): void {
    this.onWin = cb
  }

  setOnPhase1Solved(cb: () => void): void {
    this.onPhase1Solved = cb
  }

  setOnPhase2Started(cb: () => void): void {
    this.onPhase2Started = cb
  }

  setOnPhaseFailed(cb: () => void): void {
    this.onPhaseFailed = cb
  }

  setOnPhase1Interaction(cb: () => void): void {
    this.onPhase1Interaction = cb
  }

  setOnPhase2Interaction(cb: () => void): void {
    this.onPhase2Interaction = cb
  }

  getPhase1TutorialPair(): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
    if (this.mergeInProgress) return null
    const active = this.tiles.filter(t =>
      t.container.active &&
      t.container.visible &&
      this.faceUp.has(t) &&
      !this.isTopBlocked(t)
    )
    for (let i = 0; i < active.length; i++) {
      for (let j = 0; j < active.length; j++) {
        if (i === j) continue
        const a = active[i]
        const b = active[j]
        if (VALID_WORDS.includes(a.text + b.text)) {
          return {
            from: { x: a.baseDesignX, y: a.baseDesignY },
            to:   { x: b.baseDesignX, y: b.baseDesignY }
          }
        }
      }
    }
    return null
  }

  getPhase2TutorialPair(): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
    const row1: MergedVisual[] = []
    const row2: MergedVisual[] = []
    for (const mv of this.mergedVisuals) {
      if (mv.slotIndex < 0) continue
      if (this.slots[mv.slotIndex].row === 1) row1.push(mv)
      else row2.push(mv)
    }
    if (row1.length !== 3 || row2.length !== 3) return null

    const skyInRow1 = row1.filter(mv => CATEGORY_SKY.has(mv.word)).length
    const fruitsInRow1 = row1.filter(mv => CATEGORY_FRUITS.has(mv.word)).length
    const row1Cat = skyInRow1 >= fruitsInRow1 ? CATEGORY_SKY : CATEGORY_FRUITS

    const misplacedRow1 = row1.find(mv => !row1Cat.has(mv.word))
    const misplacedRow2 = row2.find(mv => row1Cat.has(mv.word))
    if (!misplacedRow1 || !misplacedRow2) return null

    const offY = this.layout.getSlotsYOffset()
    return {
      from: { x: misplacedRow1.designX, y: misplacedRow1.designY + offY },
      to:   { x: misplacedRow2.designX, y: misplacedRow2.designY + offY }
    }
  }

  private checkOutOfMoves(): void {
    if (this.failFired || this.winFired) return
    if (this.layout.getMovesRemaining() > 0) return
    if (this.phase2Enabled) {
      // Phase 2: all slots are always filled; the win gate is every merged tile locked.
      if (this.mergedVisuals.every(mv => mv.locked)) return
    } else {
      // Phase 1: filling all slots = phase 1 complete (handled separately), not a fail.
      if (this.occupiedSlots.size === this.slots.length) return
    }
    this.failFired = true
    this.onPhaseFailed?.()
  }

  relayout(): void {
    for (const mt of this.mergingTiles) {
      mt.container.setPosition(sx(mt.designX), sy(mt.designY))
    }
    for (const mv of this.mergedVisuals) this.applyMergedVisual(mv)
    for (const cb of this.categoryBars) this.applyCategoryBar(cb)
  }

  private applyCategoryBar(cb: CategoryBar): void {
    const offY = this.layout.getSlotsYOffset()
    const s = cb.s
    const baseDY = cb.rowDesignY + offY + cb.jumpDY
    cb.bar.setPosition(sx(CATEGORY_BAR_LEFT_DX), sy(baseDY))
    cb.bar.setDisplaySize(sd(CATEGORY_BAR_DESIGN_W * s), sd(CATEGORY_BAR_DESIGN_H))
    const centerDX = CATEGORY_BAR_LEFT_DX + CATEGORY_BAR_DESIGN_W * s / 2
    const cx = sx(centerDX)
    cb.title.setPosition(cx, sy(baseDY + CATEGORY_TITLE_OFFSET_Y * s))
    cb.title.setFontSize(sd(CATEGORY_TITLE_FONT_SIZE * s))
    cb.words.setPosition(cx, sy(baseDY + CATEGORY_WORDS_OFFSET_Y * s))
    cb.words.setFontSize(sd(CATEGORY_WORDS_FONT_SIZE * s))
  }

  private applyMergedVisual(mv: MergedVisual): void {
    const yOff = this.layout.getSlotsYOffset()
    mv.container.setPosition(sx(mv.designX), sy(mv.designY + yOff))
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

    this.onPhase1Interaction?.()

    const root = this.layout.getRoot()
    const originalIndex = root.getIndex(tile.container)

    // Parent the glow to the tile container so it inherits position/scale
    // animations (drag, returnToRest, merge). Appended last = on top of the
    // tile's face/back/label children.
    const glow = this.scene.add.image(0, sd(GLOW_OFFSET_Y), TEX.selectionGreen).setOrigin(0.5, 0.5)
    glow.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
    tile.container.add(glow)
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
    this.sound.playPickUp()
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.phase2Drag) { this.onPhase2PointerMove(p); return }
    if (!this.drag) return
    const d = this.drag
    const dx = p.x - d.pointerStartX
    const dy = p.y - d.pointerStartY
    d.tile.container.setPosition(d.tileStartX + dx, d.tileStartY + dy)

    const target = this.findHoverTarget(p.x, p.y)
    if (target !== d.hoverTarget) {
      if (d.hoverGlow) { d.hoverGlow.destroy(); d.hoverGlow = null }
      if (d.hoverTarget) d.hoverTarget.label.setColor(TILE_TEXT_COLOR)
      d.hoverTarget = target
      if (target) {
        const g = this.scene.add.image(0, sd(GLOW_OFFSET_Y), TEX.selectionYellow).setOrigin(0.5, 0.5)
        g.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
        // Halo parented to the target (follows future animations) and appended
        // last so it renders on top of the tile's face/back/label children.
        target.container.add(g)
        this.layout.getRoot().bringToTop(d.tile.container)
        d.hoverGlow = g
        target.label.setColor(HOVER_TEXT_COLOR)
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

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (this.phase2Drag) { this.onPhase2PointerUp(p); return }
    if (!this.drag) return
    const d = this.drag
    d.glow.destroy()
    if (d.hoverGlow) d.hoverGlow.destroy()
    if (d.hoverTarget) d.hoverTarget.label.setColor(TILE_TEXT_COLOR)

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
        this.layout.decrementMoves()
        this.doMerge(left, right, word)
        return
      }
      this.layout.decrementMoves()
      this.rejectInvalidPair(d.tile, target, originalIndex)
      return
    }
    this.returnToRest(d.tile, originalIndex)
  }

  private rejectInvalidPair(dragged: GameplayTile, target: GameplayTile, originalIndex: number): void {
    this.mergeInProgress = true
    this.sound.playWrong()
    const mkGlow = (t: GameplayTile) => {
      const g = this.scene.add.image(0, sd(GLOW_OFFSET_Y), TEX.selectionRed).setOrigin(0.5, 0.5)
      g.setDisplaySize(sd(GLOW_SIZE.w), sd(GLOW_SIZE.h))
      t.container.add(g)
      return g
    }
    const ga = mkGlow(dragged)
    const gb = mkGlow(target)

    this.layout.getRoot().moveTo(dragged.container, originalIndex)
    this.scene.tweens.add({
      targets: dragged.container,
      x: sx(dragged.baseDesignX),
      y: sy(dragged.baseDesignY),
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.shakeInvalid([dragged, target], () => {
          ga.destroy()
          gb.destroy()
          this.mergeInProgress = false
          this.checkOutOfMoves()
        })
      }
    })
  }

  private shakeInvalid(tiles: GameplayTile[], onComplete: () => void): void {
    const restXs = tiles.map(t => t.container.x)
    const proxy = { t: 0 }
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: SHAKE_DURATION,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const p = proxy.t
        const osc = Math.sin(p * Math.PI * 2 * SHAKE_CYCLES) * (1 - p)
        const dx = sd(SHAKE_AMPLITUDE) * osc
        for (let i = 0; i < tiles.length; i++) tiles[i].container.x = restXs[i] + dx
      },
      onComplete: () => {
        for (let i = 0; i < tiles.length; i++) tiles[i].container.x = restXs[i]
        onComplete()
      }
    })
  }

  private returnToRest(tile: GameplayTile, restoreIndex?: number): void {
    const targetX = sx(tile.baseDesignX)
    const targetY = sy(tile.baseDesignY)
    this.scene.tweens.add({
      targets: tile.container,
      x: targetX,
      y: targetY,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (restoreIndex !== undefined) this.layout.getRoot().moveTo(tile.container, restoreIndex)
      }
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
    // Unlock input the moment the merged word appears — the subsequent
    // stretch + fly-to-slot animations no longer block a fresh merge.
    this.mergeInProgress = false
    this.sound.playMerge()
    const container = this.scene.add.container(sx(MERGE_ANCHOR_DESIGN_X), sy(MERGE_ANCHOR_DESIGN_Y))
    const img = this.scene.add.image(0, 0, TEX.mergedTile).setOrigin(0.5, 0.5)
    img.setDisplaySize(sd(MERGED_TILE_SIZE.w), sd(MERGED_TILE_SIZE.h))
    const label = this.scene.add.text(0, sd(MERGED_TEXT_OFFSET_Y), word, {
      fontFamily: FONT_FAMILY,
      fontSize: `${sd(MERGED_TEXT_FONT_SIZE)}px`,
      color: MERGED_TEXT_COLOR
    }).setOrigin(0.5, 0.5)

    // Auto-fit: shrink font if the rendered label overflows the tile face.
    // label.width is in canvas px; divide by sd(1) to get design px.
    const designLabelW = label.width / sd(1)
    let fontSize = MERGED_TEXT_FONT_SIZE
    if (designLabelW > MERGED_TEXT_MAX_WIDTH) {
      fontSize = MERGED_TEXT_FONT_SIZE * (MERGED_TEXT_MAX_WIDTH / designLabelW)
      label.setFontSize(sd(fontSize))
    }

    container.add([img, label])
    this.layout.getRoot().add(container)

    // Burst spawns first, then the merged tile is brought to top so the tile
    // renders on top of the VFX (the burst surrounds the tile, doesn't cover it).
    spawnStarburst(this.scene, this.layout.getRoot(), MERGE_ANCHOR_DESIGN_X, MERGE_ANCHOR_DESIGN_Y, false)
    this.layout.getRoot().bringToTop(container)

    const mv: MergedVisual = {
      container, img, label,
      designX: MERGE_ANCHOR_DESIGN_X,
      designY: MERGE_ANCHOR_DESIGN_Y,
      designW: MERGED_TILE_SIZE.w,
      designH: MERGED_TILE_SIZE.h,
      fontSize,
      textOffsetY: MERGED_TEXT_OFFSET_Y,
      slotIndex: -1,
      word,
      locked: false
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
    mv.slotIndex = slotIndex
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
        this.sound.playSlotted()
        this.scene.tweens.add({
          targets: mv.container,
          scaleX: 0.9,
          scaleY: 0.9,
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
              onComplete: () => {
                if (this.occupiedSlots.size === this.slots.length) this.onPhase1Complete()
                else this.checkOutOfMoves()
              }
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

  private onPhase1Complete(): void {
    this.mergeInProgress = true  // block any residual input; all tiles are merged anyway
    this.onPhase1Solved?.()
    this.scene.time.delayedCall(120, () => {
      this.layout.playOutro(() => this.enablePhase2(), () => this.relayout())
    })
  }

  private enablePhase2(): void {
    this.phase2Enabled = true
    for (const mv of this.mergedVisuals) {
      if (!mv.img.input) mv.img.setInteractive()
      mv.img.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPhase2PointerDown(mv, p))
    }
    this.onPhase2Started?.()
  }

  private onPhase2PointerDown(mv: MergedVisual, p: Phaser.Input.Pointer): void {
    if (!this.phase2Enabled || this.phase2Swapping || this.phase2Drag) return
    if (mv.locked) return

    this.onPhase2Interaction?.()

    this.phase2Drag = {
      mv,
      pointerStartX: p.x,
      pointerStartY: p.y,
      containerStartX: mv.container.x,
      containerStartY: mv.container.y,
      hoverTarget: null
    }
    this.layout.getRoot().bringToTop(mv.container)
    this.sound.playPickUp()
  }

  private onPhase2PointerMove(p: Phaser.Input.Pointer): void {
    const d = this.phase2Drag
    if (!d) return
    const dx = p.x - d.pointerStartX
    const dy = p.y - d.pointerStartY
    d.mv.container.setPosition(d.containerStartX + dx, d.containerStartY + dy)
    d.hoverTarget = this.findPhase2HoverTarget(p.x, p.y)
  }

  private findPhase2HoverTarget(px: number, py: number): MergedVisual | null {
    const d = this.phase2Drag
    if (!d) return null
    for (const mv of this.mergedVisuals) {
      if (mv === d.mv) continue
      if (mv.locked) continue
      const halfW = sd(mv.designW) / 2
      const halfH = sd(mv.designH) / 2
      const cx = mv.container.x
      const cy = mv.container.y
      if (px >= cx - halfW && px <= cx + halfW && py >= cy - halfH && py <= cy + halfH) return mv
    }
    return null
  }

  private onPhase2PointerUp(_p: Phaser.Input.Pointer): void {
    const d = this.phase2Drag
    if (!d) return
    const target = d.hoverTarget
    this.phase2Drag = null
    if (target) {
      this.layout.decrementMoves()
      this.swapMergedVisuals(d.mv, target)
    }
    else this.returnMergedToSlot(d.mv)
  }

  private returnMergedToSlot(mv: MergedVisual): void {
    const slot = this.slots[mv.slotIndex]
    const offY = this.layout.getSlotsYOffset()
    this.scene.tweens.add({
      targets: mv.container,
      x: sx(slot.designX),
      y: sy(slot.designY + offY),
      duration: PHASE2_RETURN_DURATION,
      ease: 'Sine.easeOut',
      onComplete: () => {
        mv.designX = slot.designX
        mv.designY = slot.designY
      }
    })
  }

  private swapMergedVisuals(a: MergedVisual, b: MergedVisual): void {
    this.phase2Swapping = true
    const offY = this.layout.getSlotsYOffset()
    // Convert A's current free-drag display position back into design coords so
    // the tween starts from exactly where the user dropped it.
    a.designX = unsx(a.container.x)
    a.designY = unsy(a.container.y) - offY

    const slotAIndex = a.slotIndex
    const slotBIndex = b.slotIndex
    const slotA = this.slots[slotAIndex]
    const slotB = this.slots[slotBIndex]
    a.slotIndex = slotBIndex
    b.slotIndex = slotAIndex

    let done = 0
    const onDone = () => {
      done++
      if (done === 2) {
        this.sound.playSlotted()
        this.phase2Swapping = false
        this.validateCategories()
      }
    }
    this.tweenMergedToSlot(a, slotB, offY, onDone)
    this.tweenMergedToSlot(b, slotA, offY, onDone)
  }

  private tweenMergedToSlot(mv: MergedVisual, slot: SlotInfo, offY: number, onComplete: () => void): void {
    const proxy = { x: mv.designX, y: mv.designY }
    this.scene.tweens.add({
      targets: proxy,
      x: slot.designX,
      y: slot.designY,
      duration: PHASE2_SWAP_DURATION,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        mv.designX = proxy.x
        mv.designY = proxy.y
        mv.container.setPosition(sx(proxy.x), sy(proxy.y + offY))
      },
      onComplete: () => {
        mv.designX = slot.designX
        mv.designY = slot.designY
        onComplete()
      }
    })
  }

  private validateCategories(): void {
    const rows: [MergedVisual[], MergedVisual[]] = [[], []]
    for (const mv of this.mergedVisuals) {
      const row = this.slots[mv.slotIndex].row
      rows[row - 1].push(mv)
    }

    type Pending = { row: MergedVisual[], tex: string, categoryTex: string, categoryName: string, words: string[] }
    const toAnimate: Pending[] = []
    for (let r = 0; r < 2; r++) {
      const row = rows[r].sort((a, b) => a.slotIndex - b.slotIndex)
      if (row.length !== 3) continue
      if (row.every(mv => mv.locked)) continue
      const allSky = row.every(mv => CATEGORY_SKY.has(mv.word))
      const allFruits = row.every(mv => CATEGORY_FRUITS.has(mv.word))
      if (!allSky && !allFruits) continue
      const tex = r === 0 ? TEX.blueMergeTile : TEX.greenMergeTile
      const categoryTex = r === 0 ? TEX.blueCategoryTile : TEX.greenCategoryTile
      const categoryName = allSky ? 'THE SKY' : 'FRUITS'
      const words = row.map(mv => mv.word)
      toAnimate.push({ row, tex, categoryTex, categoryName, words })
    }

    this.pendingCategoryBars = toAnimate.length
    this.completedBarDesignYs = []

    if (toAnimate.length === 0) {
      this.checkOutOfMoves()
      return
    }

    for (const p of toAnimate) {
      this.playSnakeAnimation(p.row, p.tex, p.categoryTex, p.categoryName, p.words)
    }
  }

  private playSnakeAnimation(row: MergedVisual[], tex: string, categoryTex: string, categoryName: string, words: string[]): void {
    for (let i = 0; i < row.length; i++) {
      const mv = row[i]
      const isLast = i === row.length - 1
      mv.locked = true
      this.scene.time.delayedCall(i * SNAKE_STAGGER, () => {
        mv.img.setTexture(tex)
        mv.img.setDisplaySize(sd(mv.designW), sd(mv.designH))
        mv.label.setColor('#ffffff')
        const proxy = { s: 1 }
        this.scene.tweens.add({
          targets: proxy,
          s: SNAKE_SCALE_PEAK,
          duration: SNAKE_PER_TILE_DURATION / 2,
          ease: 'Sine.easeOut',
          yoyo: true,
          onUpdate: () => { mv.container.setScale(proxy.s) },
          onComplete: () => {
            mv.container.setScale(1)
            if (isLast) this.spawnCategoryBar(row, categoryTex, categoryName, words)
          }
        })
      })
    }
  }

  private spawnCategoryBar(row: MergedVisual[], tex: string, categoryName: string, words: string[]): void {
    const rowDesignY = this.slots[row[0].slotIndex].designY
    const bar = this.scene.add.image(0, 0, tex).setOrigin(0, 0.5)
    const title = this.scene.add.text(0, 0, categoryName, {
      fontFamily: FONT_FAMILY, color: CATEGORY_TITLE_COLOR
    }).setOrigin(0.5, 0.5)
    const wordsText = this.scene.add.text(0, 0, words.join(', '), {
      fontFamily: FONT_FAMILY, color: CATEGORY_WORDS_COLOR
    }).setOrigin(0.5, 0.5)

    const root = this.layout.getRoot()
    root.add([bar, title, wordsText])

    const cb: CategoryBar = {
      bar, title, words: wordsText, rowDesignY,
      s: CATEGORY_BAR_START_SCALE_X_MULT,
      jumpDY: 0,
      tiles: row.slice()
    }
    this.categoryBars.push(cb)
    this.applyCategoryBar(cb)

    const proxy = { s: CATEGORY_BAR_START_SCALE_X_MULT }
    this.scene.tweens.add({
      targets: proxy,
      s: 1,
      duration: CATEGORY_BAR_DURATION,
      ease: 'Back.easeOut',
      easeParams: [2.4],
      onUpdate: () => {
        cb.s = proxy.s
        this.applyCategoryBar(cb)
      },
      onComplete: () => {
        const offY = this.layout.getSlotsYOffset()
        this.completedBarDesignYs.push(cb.rowDesignY + offY)
        if (this.pendingCategoryBars > 0 && this.completedBarDesignYs.length >= this.pendingCategoryBars) {
          const sum = this.completedBarDesignYs.reduce((a, b) => a + b, 0)
          const midY = sum / this.completedBarDesignYs.length
          this.pendingCategoryBars = 0
          this.completedBarDesignYs = []

          this.playCategoryBarsJump(() => {
            spawnConfettiBurst(this.scene, DESIGN_WIDTH / 2, midY)

            if (!this.winFired && this.mergedVisuals.every(mv => mv.locked) && this.onWin) {
              this.winFired = true
              this.scene.time.delayedCall(WIN_AFTER_CONFETTI_DELAY, () => this.onWin?.())
            } else {
              this.checkOutOfMoves()
            }
          })
        }
      }
    })
  }

  private playCategoryBarsJump(onComplete: () => void): void {
    const bars = this.categoryBars.slice()
    if (bars.length === 0) { onComplete(); return }

    // Hide the merged tiles + their slots beneath each bar so the jump doesn't
    // expose them peeking out from below.
    for (const cb of bars) {
      for (const mv of cb.tiles) {
        mv.container.setVisible(false)
        this.slots[mv.slotIndex].image.setVisible(false)
      }
    }

    const apply = (y: number) => {
      for (const cb of bars) { cb.jumpDY = y; this.applyCategoryBar(cb) }
    }
    const proxy = { y: 0 }
    this.scene.tweens.add({
      targets: proxy,
      y: -CATEGORY_JUMP_HEIGHT,
      duration: CATEGORY_JUMP_UP_DURATION,
      ease: 'Sine.easeOut',
      onUpdate: () => apply(proxy.y),
      onComplete: () => {
        this.scene.tweens.add({
          targets: proxy,
          y: 0,
          duration: CATEGORY_JUMP_DOWN_DURATION,
          ease: 'Sine.easeIn',
          onUpdate: () => apply(proxy.y),
          onComplete: () => { apply(0); onComplete() }
        })
      }
    })
  }

  private nextSlotIndex(): number {
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.occupiedSlots.has(i)) return i
    }
    return -1
  }
}
