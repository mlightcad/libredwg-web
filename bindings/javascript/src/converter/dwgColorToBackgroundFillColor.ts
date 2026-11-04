import { Dwg_Color, Dwg_Color_Method } from '../types/index.js'

/**
 * Decodes a libredwg CMC {@link Dwg_Color} into the numeric form expected by
 * MTEXT `backgroundFillColor`: an ACI index `1..255`, or a 24-bit RGB.
 *
 * Returns `undefined` for ByLayer / ByBlock / None (and similar placeholders
 * AutoCAD stores when `bg_fill_flag` is 2 or 3 — canvas / window background).
 * Those must not be passed through as `color.rgb` (`0xC0000000` etc.), whose
 * low 24 bits are zero and render as pure black.
 */
export function dwgColorToBackgroundFillColor(
  color: Dwg_Color | undefined | null
): number | undefined {
  if (color == null) return undefined

  const methodNum = color.method as number
  const method =
    color.method != null && methodNum !== 0
      ? methodNum
      : ((color.rgb >>> 24) & 0xff)
  const index = color.index

  if (
    method === Dwg_Color_Method.ByLayer ||
    method === Dwg_Color_Method.ByBlock ||
    method === Dwg_Color_Method.None ||
    index === 256
  ) {
    return undefined
  }

  if (method === Dwg_Color_Method.ForegroundColor) {
    return 7
  }

  if (method === Dwg_Color_Method.TrueColor) {
    if (color.rgb == null) return undefined
    return color.rgb & 0xffffff
  }

  // ACI / entity colour (0xC2): prefer the index so ACI 7 stays foreground.
  // Index 0 is ByBlock — not a usable fill colour.
  if (index >= 1 && index <= 255) {
    return index
  }
  if (index === 0) {
    return undefined
  }

  if (color.rgb != null) {
    const rgb24 = color.rgb & 0xffffff
    if (rgb24 !== 0) return rgb24
  }

  return undefined
}
