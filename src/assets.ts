import background from '../Assets/BG/Background.webp'
import introLogo from '../Assets/Intro/Intro_Logo.webp'
import levelCounter from '../Assets/Gameplay/LEVEL 1.webp'
import movesContainer from '../Assets/Gameplay/Moves_Container.webp'
import tileSlot from '../Assets/Gameplay/Tile_Slot.webp'
import tileContainer from '../Assets/Gameplay/Tile_Container.webp'
import purpleBackTile from '../Assets/Gameplay/Purple_Back_Tile.webp'
import purpleFrontTile from '../Assets/Gameplay/Purple_Front_Tile.webp'
import mergedTile from '../Assets/Gameplay/Merged_Tile.webp'
import blueMergeTile from '../Assets/Gameplay/Blue_Merge_Tile.webp'
import greenMergeTile from '../Assets/Gameplay/Green_Merge_Tile.webp'
import blueCategoryTile from '../Assets/Gameplay/Blue_Category_Tile.webp'
import greenCategoryTile from '../Assets/Gameplay/Green_Category_Tile.webp'
import selectionGreen from '../Assets/Selection/Selection_Green.webp'
import selectionYellow from '../Assets/Selection/Selection_Yellow.webp'
import selectionRed from '../Assets/Selection/Selection_Red.webp'
import endCardCta from '../Assets/End Card/playnow_grn.webp'
import tutorialHand from '../Assets/Gameplay/Tutorial Hand.png'
import balooFont from '../Assets/Font/BALOO-REGULAR.ttf?inline'
import bgmSfx from '../Assets/SFX/BGM.mp3'
import mergeSfx from '../Assets/SFX/Merge.mp3'
import tileFallSfx from '../Assets/SFX/Tile Fall.mp3'
import pickUpSfx from '../Assets/SFX/Tile Pick Up.mp3'
import slottedSfx from '../Assets/SFX/Tile Slotted.mp3'
import wrongMergeSfx from '../Assets/SFX/Wrong Merge.mp3'

const starburstModules = import.meta.glob('../Assets/Starburst PNG Sequence WebP/*.webp', { eager: true, as: 'url' }) as Record<string, string>
const starburstFrames: string[] = Object.keys(starburstModules)
  .sort()
  .map(k => starburstModules[k])

export const ASSETS = {
  background,
  introLogo,
  levelCounter,
  movesContainer,
  tileSlot,
  tileContainer,
  purpleBackTile,
  purpleFrontTile,
  mergedTile,
  blueMergeTile,
  greenMergeTile,
  blueCategoryTile,
  greenCategoryTile,
  selectionGreen,
  selectionYellow,
  selectionRed,
  endCardCta,
  tutorialHand,
  starburstFrames,
  balooFont,
  bgmSfx,
  mergeSfx,
  tileFallSfx,
  pickUpSfx,
  slottedSfx,
  wrongMergeSfx
} as const

export const TEX = {
  background: 'background',
  introLogo: 'intro_logo',
  levelCounter: 'level_counter',
  movesContainer: 'moves_container',
  tileSlot: 'tile_slot',
  tileContainer: 'tile_container',
  purpleBackTile: 'purple_back_tile',
  purpleFrontTile: 'purple_front_tile',
  mergedTile: 'merged_tile',
  blueMergeTile: 'blue_merge_tile',
  greenMergeTile: 'green_merge_tile',
  blueCategoryTile: 'blue_category_tile',
  greenCategoryTile: 'green_category_tile',
  selectionGreen: 'selection_green',
  selectionYellow: 'selection_yellow',
  selectionRed: 'selection_red',
  endCardCta: 'endcard_cta',
  tutorialHand: 'tutorial_hand',
  starburst: 'starburst'  // base key — full key per frame is `starburst_${i}`
} as const

export const AUDIO = {
  bgm: 'sfx_bgm',
  merge: 'sfx_merge',
  tileFall: 'sfx_tile_fall',
  pickUp: 'sfx_pick_up',
  slotted: 'sfx_slotted',
  wrongMerge: 'sfx_wrong_merge'
} as const

export const STARBURST_FRAME_COUNT = 34
// Source frame indices (1-based, original 30fps timeline) for each unique frame.
// Used to derive per-frame durations so duplicated source frames hold longer.
export const STARBURST_SOURCE_INDICES: readonly number[] = [
  2, 4, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30,
  31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 44, 46, 48
]

export const FONT_FAMILY = 'Baloo'
