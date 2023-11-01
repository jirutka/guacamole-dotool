import { Client } from './client.js'
import { GuacamoleCommandError } from './errors.js'

export type Command = [cmd: keyof Client, ...args: any[]]

export type CommandName = keyof typeof Commands

export interface CommandInfo {
  desc: string
  method: keyof Client | ((client: Client) => Promise<void>)
  params: Array<(value: string, command: string) => any>
}

// NOTE: Commands are made to be compatible with vncdotool.
export const Commands = {
  key: {
    desc: 'Press <keystroke> (keydown and keyup).',
    method: 'keysPress',
    params: [Keystroke],
  },
  keydown: {
    desc: 'Hold down <keystroke>.',
    method: 'keysDown',
    params: [Keystroke],
  },
  keyup: {
    desc: 'Release <keystroke>.',
    method: 'keysUp',
    params: [Keystroke],
  },
  type: {
    desc: 'Type <text> as if you had typed it.',
    method: 'type',
    params: [String],
  },
  move: {
    desc: 'Move the mouse cursor to <X> <Y> coordinates.',
    method: 'mouseMove',
    params: [UnsignedInt, UnsignedInt],
  },
  mousemove: {
    desc: 'Alias for move.',
    method: 'mouseMove',
    params: [UnsignedInt, UnsignedInt],
  },
  click: {
    desc: 'Send a mouse <button> click (mousedown followed by mouseup).',
    method: 'mouseClick',
    params: [String],
  },
  doubleclick: {
    desc: 'Send a mouse <button> double-click.',
    method: 'mouseClick',
    params: [String],
  },
  mousedown: {
    desc: 'Hold down mouse <button>.',
    method: 'mouseButtonDown',
    params: [String],
  },
  mouseup: {
    desc: 'Release mouse <button>.',
    method: 'mouseButtonUp',
    params: [String],
  },
  scroll: {
    desc: 'Scroll number of <lines> up (positive number) or down (negative number).',
    method: 'scroll',
    params: [SignedInt],
  },
  capture: {
    desc: 'Save current screen as <file>.',
    method: 'captureScreenToFile',
    params: [String],
  },
  pause: {
    desc: 'Wait <seconds> before sending next command.',
    method: 'pause',
    params: [ValidNumber],
  },
} satisfies Record<string, CommandInfo>

/**
 * Parses the given script into commands that can be interpreted by
 * {@link interpretCommands}.
 *
 * Parsing follows very similar rules to _shell words_:
 *
 * - Each double-quoted substring is interpreted as a single argument.
 * - Backslash (`\`) is interpreted as an escape character. It can be used to
 *   escape double quotes (`"`) and whitespaces. It's always stripped, so
 *   to use a literal backslash, it must be doubled (`\\`).
 * - Everything after `#` to the end of the line is interpreted as a comment and
 *   stripped iif it's not inside a double-quoted substring and it's at the
 *   start of a line or comes after one or more whitespaces.
 *
 * @throws {@link GuacamoleCommandError} on unknown command and invalid arguments.
 */
export function parseScript(content: string): Command[] {
  return parseCommands(parseScriptToWords(content).words)
}

/**
 * @internal Splits the `input` text to “words” by a (ASCII) whitespace.
 * See {@link parseScript} for a detailed description.
 */
export function parseScriptToWords(input: string): { words: string[]; unclosed: boolean } {
  const words = ['']

  const regex = /^#[^\n]*\n|[^\\"\s]+|\s+(?:#[^\n]*)?|"|\\./gs
  let quoted: 0 | 1 = 0
  let match: string | undefined

  while ((match = regex.exec(input)?.[0]) != null) {
    if (match[0] === '\\') {
      words[words.length - 1] += match[1] // strip \
    } else if (match === '"') {
      quoted ^= 1
    } else if (quoted) {
      words[words.length - 1] += match
    } else {
      match = match.trimStart()
      if (match === '') {
        words.push('') // start a new word
      } else if (match[0] !== '#') {
        words[words.length - 1] += match
      }
    }
  }
  return { words, unclosed: !!quoted }
}

/**
 * Parses the given list of `words` into commands that can be interpreted by
 * {@link interpretCommands}.
 *
 * @throws {@link GuacamoleCommandError} on unknown command and invalid arguments.
 */
export function parseCommands(words: string[]): Command[] {
  words = [...words]
  const cmds = []

  while (words.length > 0) {
    const cmd = words.shift()!
    if (!Object.hasOwn(Commands, cmd)) {
      throw new GuacamoleCommandError('UNKNOWN', cmd, 'is not a valid command')
    }
    const info = Commands[cmd as CommandName]

    if (words.length < info.params.length) {
      throw new GuacamoleCommandError(
        'INVALID_ARGUMENT',
        cmd,
        `expects ${info.params.length} arguments, but got only ${words.length}`,
      )
    }
    const params = info.params.map(parse => parse(words.shift()!, cmd))
    cmds.push([info.method, ...params])
  }
  return cmds as Command[]
}

/**
 * Interprets the `commands` list using the given `client`.
 *
 * @see {@link parseCommands}
 * @see {@link parseScript}
 */
export async function interpretCommands(client: Client, commands: Command[]): Promise<void> {
  for (const [cmd, ...args] of commands) {
    const res = (client[cmd] as any)(...args)
    if (res instanceof Promise) {
      await res
    }
  }
}

export { Keystroke as parseCombinedKeys }

/**
 * Splits the given sequence of keys separated by `+` or `-` (whichever is
 * found in the value first).
 */
function Keystroke(value: string): string[] {
  const negToInf = (n: number) => (n < 0 ? Infinity : n)
  const separator = negToInf(value.indexOf('+')) < negToInf(value.indexOf('-')) ? '+' : '-'

  return value.split(separator).reduce<string[]>((acc, key) => {
    if (acc.at(-1) === '') {
      acc[acc.length - 1] = `${separator}${key}`
    } else {
      acc.push(key)
    }
    return acc
  }, [])
}

function SignedInt(value: string, command: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new GuacamoleCommandError(
      'INVALID_ARGUMENT',
      command,
      `expects a signed integer, but got: ${value}`,
    )
  }
  return Number(value)
}

function UnsignedInt(value: string, command: string): number {
  if (!/^\d+$/.test(value)) {
    throw new GuacamoleCommandError(
      'INVALID_ARGUMENT',
      command,
      `expects an unsigned integer, but got: ${value}`,
    )
  }
  return Number(value)
}

function ValidNumber(value: string, command: string): number {
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new GuacamoleCommandError(
      'INVALID_ARGUMENT',
      command,
      `expects an integer or float, but got: ${value}`,
    )
  }
  return num
}
