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
 * Parses the given list of `tokens` (white-space separated or double-quoted)
 * into commands that can be interpreted by {@link interpretCommands}.
 *
 * @throws {@link GuacamoleCommandError} on unknown command and invalid arguments.
 */
export function parseCommands(tokens: string[]): Command[] {
  tokens = [...tokens]
  const cmds = []

  while (tokens.length > 0) {
    const cmd = tokens.shift()!
    if (!Object.hasOwn(Commands, cmd)) {
      throw new GuacamoleCommandError('UNKNOWN', cmd, 'is not a valid command')
    }
    const info = Commands[cmd as CommandName]

    if (tokens.length < info.params.length) {
      throw new GuacamoleCommandError(
        'INVALID_ARGUMENT',
        cmd,
        `expects ${info.params.length} arguments, but got only ${tokens.length}`,
      )
    }
    const params = info.params.map(parse => parse(tokens.shift()!, cmd))
    cmds.push([info.method, ...params])
  }
  return cmds as Command[]
}

/**
 * Parses the given script into commands that can be interpreted by
 * {@link interpretCommands}.
 *
 * @throws {@link GuacamoleCommandError} on unknown command and invalid arguments.
 */
export function parseScript(content: string): Command[] {
  const words = splitTextWithQuotes(content)
    .filter(words => words.length > 0 && !words[0].startsWith('#'))
    .flat()

  return parseCommands(words)
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

/**
 * Splits text to words and double-quoted parts. Returns two-dimensional array
 * where the first dimension are lines, the second are words on the line.
 * Newlines in double-quoted parts are preserved, i.e. it's treat as a single
 * word.
 */
function splitTextWithQuotes(input: string): string[][] {
  const regex = /"([^"\\]*(\\.[^"\\]*)*)"|(\S+)|(\n)/g
  const lines: string[][] = []

  let words: string[] = []
  let match
  while ((match = regex.exec(input)) !== null) {
    if (match[4]) {
      lines.push(words)
      words = []
    } else if (match[1]) {
      words.push(match[1].replace(/\\"/g, '"'))
    } else {
      words.push(match[3])
    }
  }
  lines.push(words)

  return lines
}
