/**
 * AutoCAD stores characters outside the drawing's code page as `\U+XXXX`
 * escape sequences (exactly four hex digits). Decode them so TEXT / MTEXT /
 * ATTRIB / layer names become real Unicode instead of literal escapes.
 *
 * Adjacent high/low surrogate escapes (e.g. `\U+D83D\U+DE00`) expand to
 * UTF-16 code units that form one supplementary-plane character in JS strings.
 */
const UNICODE_ESCAPE = /\\U\+([0-9A-Fa-f]{4})/g

/**
 * Replaces AutoCAD `\U+XXXX` escapes with the corresponding Unicode characters.
 */
export function decodeUnicodeEscapes(text: string): string {
  if (!text || !text.includes('\\U+')) {
    return text
  }
  return text.replace(UNICODE_ESCAPE, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
}
