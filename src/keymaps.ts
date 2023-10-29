import type { Client } from './client.js'
import { Enum } from './utils.js'

type Keysyms<K extends string = string> = Readonly<Record<K, number | undefined>>

// NOTE: Some alternative names are for compatibility with vncdotool.
// Source: https://www.x.org/releases/X11R7.7/doc/xproto/x11protocol.html#keysym_encoding
// prettier-ignore
const ControlKeysyms = Object.freeze({
  Space: 0x20,

  Backspace: 0xff08, Bsp: 0xff08,
  Tab: 0xff09,
  Enter: 0xff0d,
  Pause: 0xff13,
  ScrollLock: 0xff14, ScrLk: 0xff14,
  SysReq: 0xff15, SysRq: 0xff15,
  Escape: 0xff1b, Esc: 0xff1b,

  Home: 0xff50,
  Left: 0xff51,
  Up: 0xff52,
  Right: 0xff53,
  Down: 0xff54,
  PageUp: 0xff55, PgUp: 0xff55,
  PageDown: 0xff56, PgDown: 0xff56, PgDn: 0xff56,
  End: 0xff57,

  PrintScreen: 0xff61, PrtSc: 0xff61,
  Insert: 0xff63, Ins: 0xff63,
  Menu: 0xff67,
  NumLock: 0xff7f, NumLk: 0xff7f,

  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,
  F13: 0xffca,
  F14: 0xffcb,
  F15: 0xffcc,
  F16: 0xffcd,
  F17: 0xffce,
  F18: 0xffcf,
  F19: 0xffd0,
  F20: 0xffd1,
  F21: 0xffd2,
  F22: 0xffd3,
  F23: 0xffd4,
  F24: 0xffd5,

  Delete: 0xffff, Del: 0xffff,
}) satisfies Keysyms

// Source: https://www.x.org/releases/X11R7.7/doc/xproto/x11protocol.html#keysym_encoding
// prettier-ignore
const ModifierKeysyms = Object.freeze({
  LShift: 0xffe1, Shift: 0xffe1,
  RShift: 0xffe2,
  LCtrl: 0xffe3, Ctrl: 0xffe3,
  RCtrl: 0xffe4,
  CapsLock: 0xffe5, CapLk: 0xffe5,
  LAlt: 0xffe9, Alt: 0xffe9,
  RAlt: 0xffea,
  LSuper: 0xffeb, Super: 0xffeb, Cmd: 0xffeb, Win: 0xffeb,
  RSuper: 0xffec,
}) satisfies Keysyms

/** Printable characters in the US keymap mapped to their code point. */
// Source: https://www.x.org/releases/X11R7.7/doc/xproto/x11protocol.html#keysym_encoding
// prettier-ignore
const PrintableKeysyms = codePointsMap([
  '`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=',
  'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']',
  'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", '\\',
  'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/',
  ' ',
] as const) satisfies Keysyms

/**
 * Mapping of printable characters that are typed with Shift key (on US keymap)
 * to a sequence of keysym codes (Shift and the corresponding key).
 */
// prettier-ignore
const PrintableShiftedKeysyms = shifted(ModifierKeysyms.Shift, {
  '~': '`',
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  '_': '-',
  '+': '=',

  'Q': 'q',
  'W': 'w',
  'E': 'e',
  'R': 'r',
  'T': 't',
  'Y': 'y',
  'U': 'u',
  'I': 'i',
  'O': 'o',
  'P': 'p',
  '{': '[',
  '}': ']',

  'A': 'a',
  'S': 's',
  'D': 'd',
  'F': 'f',
  'G': 'g',
  'H': 'h',
  'J': 'j',
  'K': 'k',
  'L': 'l',
  ':': ';',
  '"': "'",
  '|': '\\',

  'Z': 'z',
  'X': 'x',
  'C': 'c',
  'V': 'v',
  'B': 'b',
  'N': 'n',
  'M': 'm',
  '<': ',',
  '>': '.',
  '?': '/',
}, PrintableKeysyms)

export const ModifierKey = Enum(
  ...(Object.keys(ModifierKeysyms) as Array<keyof typeof ModifierKeysyms>),
)
export type ModifierKey = Enum<typeof ModifierKey>

const ControlKey = Enum(...(Object.keys(ControlKeysyms) as Array<keyof typeof ControlKeysyms>))
type ControlKey = Enum<typeof ControlKey>

/** Names of control and modifier keys. */
export const Key = { ...ModifierKey, ...ControlKey }
export type Key = ModifierKey | ControlKey

/**
 * @private
 * Extract a string union of all key names (except the combined) and a `number`
 * (direct keysym code).
 */
export type KeymapKey<T extends Keymap> =
  | keyof T['modifiers']
  | keyof T['control']
  | keyof T['printable']
  | number

/** Mapping of keyboard keys to keysym codes. */
export interface Keymap<TPrintable extends string = string> {
  /**
   * Name of this keymap.
   */
  readonly name: string
  /**
   * If a given character is not found in `printable` or `combined` maps and
   * this is `true`, it should be translated to its code point. If `false`, it
   * should throw an error.
   */
  readonly allowFallback: boolean
  /**
   * Keysym codes of modifier keys.
   */
  readonly modifiers: Keysyms<ModifierKey>
  /**
   * Keysym codes of Control keys.
   */
  readonly control: Keysyms<ControlKey>
  /**
   * Keysym codes of printable characters that are available on the 1st level
   * (i.e. without any modifier key).
   */
  readonly printable: Keysyms<TPrintable>
  /**
   * Keysym sequences of characters that can be typed with a modifier.
   */
  readonly combined: Record<string, readonly number[] | undefined>
}

/** The default keymap (US). */
export type DefaultKeymap = Keymap<keyof typeof PrintableKeysyms>

const defaultKeymap: DefaultKeymap = Object.freeze({
  name: 'us',
  allowFallback: false,
  combined: PrintableShiftedKeysyms,
  control: ControlKeysyms,
  modifiers: ModifierKeysyms,
  printable: PrintableKeysyms,
})

export const Keymaps = {
  /**
   * A special keymap with only control & modifier keys and allowed fallback -
   * the {@link Client} will map any printable ASCII and Unicode key to its
   * code point.
   *
   * This is unusable for QEMU/KVM VNC (Guacamole's “independent of keyboard
   * layout” is a lie), but it might work well on others.
   */
  DIRECT: Object.freeze({
    ...defaultKeymap,
    name: 'direct',
    allowFallback: true,
    combined: {},
    printable: {} as Record<string, number>,
  }),

  /** US QWERTY - PC variant (the default) */
  US: defaultKeymap,

  /** US QWERTY - macOS variant */
  US_MAC: Object.freeze({
    ...defaultKeymap,
    name: 'us-mac',
    combined: { ...defaultKeymap.combined, '~': undefined },
    printable: { ...defaultKeymap.printable, '`': 0x3c },
  }),
} satisfies Record<string, Keymap>

function codePointsMap<C extends string>(chars: readonly C[]): Readonly<Record<C, number>> {
  const obj = chars.reduce((acc, char) => {
    acc[char] = char.codePointAt(0)
    return acc
  }, {} as any)
  return Object.freeze(obj)
}

function shifted<K1 extends string, K2 extends string>(
  modifier: number,
  map: Record<K1, K2>,
  keysyms: Record<K2, number>,
): Readonly<Record<K1, number[]>> {
  const res = Object.entries(map).reduce(
    (acc, [k1, k2]) => {
      acc[k1 as K1] = [modifier, keysyms[k2 as K2]]
      return acc
    },
    {} as Record<K1, number[]>,
  )
  return Object.freeze(res)
}
