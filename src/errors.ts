import Guacamole from 'guacamole-common-js'

export class GuacamoleError extends Error {}

export class GuacamoleProtocolError extends GuacamoleError {
  public code: ProtocolErrorCode

  constructor(status: Guacamole.Status) {
    const code = statusNumberToCode[status.code] ?? 'UNKNOWN'
    const message = status.message ? `${code}: ${status.message}` : code
    super(message, { cause: status })

    this.code = code
  }
}

export type ProtocolErrorCode =
  | Exclude<keyof typeof Guacamole.Status.Code, 'fromHTTPCode' | 'fromWebSocketCode' | 'SUCCESS'>
  | 'UNKNOWN'

const statusNumberToCode = Object.entries(Guacamole.Status.Code).reduce(
  (acc, [code, num]) => {
    if (typeof num === 'number') {
      acc[num] = code as ProtocolErrorCode
    }
    return acc
  },
  {} as Record<number, ProtocolErrorCode>,
)

export class GuacamoleClientError extends GuacamoleError {
  public code: ClientErrorCode

  constructor(code: ClientErrorCode, message: string, opts?: ErrorOptions) {
    super(`${code}: ${message}`, opts)
    this.code = code
  }
}

export type ClientErrorCode = 'CANVAS_NOT_INITIALIZED' | 'NOT_CONNECTED' | 'UNKNOWN_KEY'

export class GuacamoleCommandError extends GuacamoleError {
  public code: CommandErrorCode
  public command: string

  constructor(code: CommandErrorCode, command: string, message?: string, opts?: ErrorOptions) {
    super(`Command "${command}" ${message}`, opts)
    this.code = code
    this.command = command
  }
}

export type CommandErrorCode = 'UNKNOWN' | 'INVALID_ARGUMENT'
