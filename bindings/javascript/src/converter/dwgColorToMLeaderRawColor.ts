import { Dwg_Color, Dwg_Color_Method } from '../types'

/** MLEADER / MLEADERSTYLE packed raw-color type flags (DXF high byte). */
const RAW_COLOR_TYPE_BY_LAYER = 0xc0
const RAW_COLOR_TYPE_BY_BLOCK = 0xc1
const RAW_COLOR_TYPE_RGB = 0xc2
const RAW_COLOR_TYPE_ACI = 0xc3
const RAW_COLOR_TYPE_WINDOW_BG = 0xc8

/**
 * Converts a libredwg {@link Dwg_Color} (CMC) to the DXF MLEADER raw-color int32
 * used by group codes 91/92/93/94 and {@link decodeMLeaderStyleRawColor}.
 *
 * Libredwg stores MLeader component colors as packed int32 in {@link Dwg_Color.rgb}
 * with {@link Dwg_Color.method} mirroring the high-byte type flag (0xC0..0xC8).
 */
export function dwgColorToMLeaderRawColor(
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
    color.rgb != null &&
    method >= RAW_COLOR_TYPE_BY_LAYER &&
    method <= RAW_COLOR_TYPE_WINDOW_BG &&
    ((color.rgb >>> 24) & 0xff) === method
  ) {
    return color.rgb >> 0
  }

  if (method === Dwg_Color_Method.ByLayer || index === 256) {
    return (RAW_COLOR_TYPE_BY_LAYER << 24) >> 0
  }
  if (method === Dwg_Color_Method.ByBlock || index === 0) {
    return (RAW_COLOR_TYPE_BY_BLOCK << 24) >> 0
  }
  if (method === Dwg_Color_Method.None) {
    return (RAW_COLOR_TYPE_WINDOW_BG << 24) >> 0
  }
  if (method === Dwg_Color_Method.TrueColor) {
    const rgb = color.rgb != null ? color.rgb & 0xffffff : undefined
    if (rgb != null) {
      return ((RAW_COLOR_TYPE_RGB << 24) | rgb) >> 0
    }
  }
  if (method === Dwg_Color_Method.ForegroundColor) {
    return ((RAW_COLOR_TYPE_ACI << 24) | 7) >> 0
  }
  if (method === Dwg_Color_Method.Entities && index > 0 && index < 256) {
    return ((RAW_COLOR_TYPE_ACI << 24) | (index & 0xff)) >> 0
  }
  if (index > 0 && index < 256) {
    return ((RAW_COLOR_TYPE_ACI << 24) | (index & 0xff)) >> 0
  }

  return (RAW_COLOR_TYPE_BY_BLOCK << 24) >> 0
}
