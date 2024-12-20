import * as FS from 'node:fs/promises'
import { exit, stdin } from 'node:process'

import { Flags, typeFlag } from 'type-flag'

import { Client } from './client.js'
import {
  Command,
  CommandInfo,
  Commands,
  interpretCommands,
  parseCommands,
  parseScript,
} from './commands.js'
import { GuacamoleError } from './errors.js'
import { setDomGlobals } from './global.js'
import { Keymap, Keymaps } from './keymaps.js'
import { startRepl } from './repl.js'
import { camelToKebab, Entries, omitUndefined, wrapText } from './utils.js'

const ProgName = 'guacamole-dotool'
const Version = '0.2.1'

const Help = `\
Usage:
  ${ProgName} [options] [--] [<cmd> [<cmd-args>]]...
  ${ProgName} [options] --from-file <file>
  ${ProgName} (--version | --help)

Connect to a remote host via Guacamole over WebSocket and send commands.

If no commands are provided as arguments, it reads from stdin. If stdin is a
terminal, REPL is started.

Commands:
${formatCommandsForHelp(Commands, 80)}

Arguments:
  <button>     Mouse button: "left", "middle" or "right".
  <keystroke>  One or more keys separated by "+" or "-" (e.g. Ctrl+Shift+c).

Options:
     --url <url>                URL of Guacamole WebSocket endpoint to connect
                                to (wss:// or ws://).

  -f --from-file <file>         Read commands from <file>.

     --keymap <keymap>          Keyboard layout on the remote host. Options:
                                "us" (default), "us-mac" or "direct" (disables
                                translation of key codes for printable chars).

     --delay-between-keys <ms>  Delay in milliseconds between keystrokes.
                                Default is 50.

     --double-click-delay <ms>  Delay in milliseconds between repeated mouse
                                clicks. Default is 100.

     --toggle-delay <ms>        Delay in milliseconds between key down and up.
                                Default is 12.

  -V --version                  Print program version and exit.

  -h --help                     Show this message and exit.

Environment:
  GUACAMOLE_URL                 The same as --url.

Reports bugs to <https://github.com/jirutka/guacamole-dotool/issues>.\
`

async function main() {
  const { opts, args, errors } = parseCliArgs(process.argv.slice(2), process.env)

  if (opts.help) {
    console.log(Help)
    exit(0)
  }

  if (opts.version) {
    console.log(`${ProgName} ${Version}`)
    exit(0)
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`${ProgName}: ${error}`)
    }
    exit(1)
  }

  const keymap = findKeymap(opts.keymap)
  if (!keymap) {
    console.error(`${ProgName}: Unknown keymap: ${opts.keymap}`)
  }

  let commands: Command[]
  if (opts.fromFile) {
    const script = await FS.readFile(opts.fromFile, 'utf-8')
    commands = parseScript(script)

    if (commands.length === 0) {
      console.error(`${ProgName}: No commands read from ${opts.fromFile}`)
      exit(1)
    }
  } else {
    commands = parseCommands(args)
  }

  setDomGlobals(global)

  const client = await Client.connect(opts.url!, keymap, opts)

  if (commands.length > 0) {
    await interpretCommands(client, commands)
  } else {
    await startRepl(client, isInteractive())
  }

  client.disconnect()
}

function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv) {
  const schemas = {
    url: {
      type: String,
      default: env.GUACAMOLE_URL,
    },
    fromFile: {
      type: String,
      alias: 'f',
    },
    keymap: {
      type: String,
      default: 'us',
    },
    delayBetweenKeys: {
      type: Number,
    },
    doubleClickDelay: {
      type: Number,
    },
    toggleDelay: {
      type: Number,
    },
    version: {
      type: Boolean,
      alias: 'V',
    },
    help: {
      type: Boolean,
      alias: 'h',
    },
  } satisfies Flags<Record<string, unknown>>

  const { _: args, flags, unknownFlags } = typeFlag(schemas, argv)
  const errors: string[] = []

  for (const [name, value] of Object.entries(flags) as Entries<typeof flags>) {
    if (schemas[name].type === Number && Number.isNaN(value)) {
      errors.push(`Option --${camelToKebab(name)} expects number, but got: ${value}`)
    }
  }

  if (!flags.url?.length) {
    errors.push(`Missing required option: --url`)
  }

  const unknowns = Object.keys(unknownFlags).map(flag =>
    flag.length > 1 ? `--${flag}` : `-${flag}`,
  )
  if (unknowns.length > 0) {
    errors.push(`Unknown options: ${unknowns.join(', ')} (see --help)`)
  }

  return {
    opts: omitUndefined(flags),
    args: args as string[],
    errors,
  }
}

function findKeymap(name: string): Keymap | undefined {
  name = name.toUpperCase().replaceAll('-', '_')
  return Keymaps[name as keyof typeof Keymaps]
}

function formatCommandsForHelp(commands: Record<string, CommandInfo>, maxWidth = 80): string {
  const columnWidth =
    Object.keys(commands).reduce((maxLen, key) => Math.max(maxLen, key.length), 0) + 4

  return Object.entries(commands)
    .reduce<string[]>((lines, [key, { desc }]) => {
      let cnt = 0
      for (const line of wrapText(desc, maxWidth - columnWidth)) {
        if (cnt++ === 0) {
          lines.push(`  ${key}`.padEnd(columnWidth) + line)
        } else {
          lines.push(' '.repeat(columnWidth) + line)
        }
      }
      return lines
    }, [])
    .join('\n')
}

function isInteractive(): boolean {
  return stdin.isTTY && process.env.TERM !== 'dumb'
}

//////////////////////////////  M a i n  //////////////////////////////

main().catch(err => {
  if (err instanceof GuacamoleError) {
    console.error(`${ProgName}: ${err.message}`)
  } else {
    console.error(`${ProgName}:`, err)
  }
  exit(1)
})
