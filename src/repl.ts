import { stdin, stdout } from 'node:process'
import { createInterface as createReadLine } from 'node:readline'

import { interpretCommands, parseScript } from './commands.js'
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
  for await (const line of readline) {
    try {
      await interpretCommands(client, parseScript(line))
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
