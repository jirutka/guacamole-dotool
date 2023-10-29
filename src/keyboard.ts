import assert from 'node:assert/strict'

import { GuacamoleClientError } from './errors.js'
import { Keymap } from './keymaps.js'

export interface KeyboardMapper<TKeymap extends Keymap> {
  readonly keymap: TKeymap
  /**
   * Searches case-insensitive for the given `key` in the `keymap`'s `control`,
   * `modifiers`, and `printable` tables and returns its keysym code, or throws
   * error if not found.
   *
   * @throws {GuacamoleClientError} if the `key` was not found in the `keymap`.
   */
  translateKey(key: string): number
  /**
   * Searches for the given `char` in the `keymap`'s `printable` and `combined`
   * tables and returns its keysym code sequence. If not found and
   * `keysym.allowFallback` is `true`, it returns the codepoint-based keysym
   * code of the character. If it's `false`, it throws an error.
   *
   * @throws {GuacamoleClientError} if the `char` was not found in the `keymap`.
   */
  translateChar(char: string): readonly number[]
}

export function KeyboardMapper<TKeymap extends Keymap>(keymap: TKeymap): KeyboardMapper<TKeymap> {
  // Build lookup table
  const keysMap = Object.entries({
    ...keymap.control,
    ...keymap.modifiers,
    ...keymap.printable,
  }).reduce((map, [name, code]) => {
    if (code != null) {
      map.set(name.toLowerCase(), code)
    }
    return map
  }, new Map<string, number>())

  const charsMap = new Map<string, readonly number[]>()
  for (const [name, code] of Object.entries(keymap.printable)) {
    if (code != null) {
      charsMap.set(name, [code])
    }
  }
  for (const [name, codes] of Object.entries(keymap.combined)) {
    if (codes != null) {
      charsMap.set(name, codes)
    }
  }
  charsMap
    .set('\n', [keysMap.get('enter')!])
    .set(' ', [keysMap.get('space')!])
    .set('\t', [keysMap.get('tab')!])

  return {
    keymap,

    translateKey(key: string): number {
      if (key.startsWith('0x')) {
        return parseInt(key.substring(2), 16)
      }
      const keysym = keysMap.get(key.toLowerCase())
      if (!keysym) {
        throw new GuacamoleClientError(
          'UNKNOWN_KEY',
          `Unable to translate key "${key}" to keysym code with keymap ${keymap.name}`,
        )
      }
      return keysym
    },

    translateChar(char: string): readonly number[] {
      assert(
        typeof char === 'string' && char.length === 1,
        `expected single character, but got: ${char}`,
      )

      const keysyms = charsMap.get(char)
      if (keysyms) {
        return keysyms
      }
      if (keymap.allowFallback) {
        return [keysymFromCodePoint(char.codePointAt(0)!)]
      }
      throw new GuacamoleClientError(
        'UNKNOWN_KEY',
        `Unable to translate character "${char}" to keysym code with keymap ${keymap.name}`,
      )
    },
  }
}

/**
 * Translates the given character code point to the corresponding keysym code
 * according to https://www.x.org/releases/X11R7.7/doc/xproto/x11protocol.html#keysym_encoding.
 */
function keysymFromCodePoint(codepoint: number): number {
  // ASCII control characters
  if (isControlChar(codepoint)) {
    return 0xff00 | codepoint
  }
  // ASCII non-control characters
  if (codepoint >= 0x0000 && codepoint <= 0x00ff) {
    return codepoint
  }
  // Unicode
  if (codepoint >= 0x0100 && codepoint <= 0x10ffff) {
    return 0x01000000 | codepoint
  }
  throw new RangeError(`Invalid code point: ${codepoint}`)
}

function isControlChar(codepoint: number): boolean {
  return codepoint <= 0x1f || (codepoint >= 0x7f && codepoint <= 0x9f)
}
