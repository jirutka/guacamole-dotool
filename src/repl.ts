import { stdin, stdout } from 'node:process'
import { createInterface as createReadLine } from 'node:readline'

import { interpretCommands, parseCommands, parseScriptToWords } from './commands.js'
import { Client } from './client.js'

export async function startRepl(client: Client, interactive: boolean) {
  const readline = createReadLine({
    input: stdin,
    output: stdout,
    prompt: interactive ? '> ' : '',
    terminal: interactive,
  })
  if (interactive) {
    readline.on('close', () => stdout.write('\n'))
  }

  readline.prompt()

  let prev = ''
  for await (const line of readline) {
    try {
      const { words, unclosed } = parseScriptToWords(prev + line)

      if (unclosed) {
        prev += line + '\n'
        interactive && readline.setPrompt('... ')
      } else {
        prev = ''
        interactive && readline.setPrompt('> ')
        await interpretCommands(client, parseCommands(words))
      }
    } catch (err: any) {
      if (interactive) {
        console.error(`ERROR: ${err.message}`)
      } else {
        throw err
      }
    }
    readline.prompt()
  }
}
