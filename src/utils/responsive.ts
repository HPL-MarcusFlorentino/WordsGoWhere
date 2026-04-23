import { DESIGN_WIDTH, DESIGN_HEIGHT } from '../constants'

let _s = 1
let _offX = 0
let _offY = 0
let _vw = DESIGN_WIDTH
let _vh = DESIGN_HEIGHT

export function recomputeResponsive(viewW: number, viewH: number): void {
  _vw = viewW
  _vh = viewH
  _s = Math.min(viewW / DESIGN_WIDTH, viewH / DESIGN_HEIGHT)
  _offX = (viewW - DESIGN_WIDTH * _s) / 2
  _offY = (viewH - DESIGN_HEIGHT * _s) / 2
}

export const sx = (x: number) => _offX + x * _s
export const sy = (y: number) => _offY + y * _s
export const sd = (d: number) => d * _s
export const viewW = () => _vw
export const viewH = () => _vh
export const scale = () => _s
