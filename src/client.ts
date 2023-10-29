import assert from 'node:assert/strict'
import * as FS from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

import type { Canvas, PngConfig } from 'canvas'
import Guacamole from 'guacamole-common-js'
// @ts-ignore
import JSDOMUtils from 'jsdom/lib/jsdom/living/generated/utils.js'

import { GuacamoleClientError, GuacamoleProtocolError } from './errors.js'
import type { setDomGlobals } from './global.js'
import { KeyboardMapper } from './keyboard.js'
import { Keymaps } from './keymaps.js'
import type { Keymap, KeymapKey, ModifierKey, DefaultKeymap } from './keymaps.js'
import { MouseButton } from './mouse.js'
import { Enum } from './utils.js'

export interface ClientOptions {
  /**
   * Delay in milliseconds between key down and up.
   * @default 12
   */
  toggleDelay?: number
  /**
   * Delay in milliseconds between repeated mouse clicks.
   * @default 100
   */
  doubleClickDelay?: number
  /**
   * Delay in milliseconds between keystrokes.
   * @default 50
   */
  delayBetweenKeys?: number
}

// NOTE: These numbers are made up.
const defaultOptions = {
  toggleDelay: 12,
  doubleClickDelay: 100,
  delayBetweenKeys: 50,
} satisfies Required<ClientOptions>

/** @see {@link Client.connect} */
export interface Client<TKeymap extends Keymap = DefaultKeymap> {
  /** Presses `keys` (`keysDown` followed by `keysUp`). */
  keysPress(keys: readonly KeymapKey<TKeymap>[]): Promise<void>
  keysPress(...keys: KeymapKey<TKeymap>[]): Promise<void>

  /** Holds down `keys` (all at once). */
  keysDown(keys: readonly KeymapKey<TKeymap>[]): void
  keysDown(...keys: KeymapKey<TKeymap>[]): void

  /** Releases `keys` (all at once). */
  keysUp(keys: readonly KeymapKey<TKeymap>[]): void
  keysUp(...keys: KeymapKey<TKeymap>[]): void

  /** Types `text` as if you had typed it. */
  type(text: string): Promise<void>

  /** Sends a mouse `button` click. */
  mouseClick(button: MouseButton, count?: number, modifiers?: ModifierKey[]): Promise<void>

  /** @deprecated This should be used only for commands. */
  mouseDoubleClick(button: MouseButton): Promise<void>

  /** Holds down mouse `button`. */
  mouseButtonDown(button: MouseButton): void

  /** Releases mouse `button`. */
  mouseButtonUp(button: MouseButton): void

  /** Scrolls number of `lines` up (positive number) or down (negative number). */
  scroll(lines: number): Promise<void>

  /** Moves the mouse cursor to `x`, `y` coordinates. */
  mouseMove(x: number, y: number): Promise<void>

  /** Takes a screenshot of the current screen and returns PNG data. */
  captureScreen(config?: PngConfig): Buffer

  /** Takes a screenshot and saves PNG to the `filename`. */
  captureScreenToFile(filename: string, config?: PngConfig): Promise<void>

  /** Waits `seconds`. */
  pause(seconds: number): Promise<void>

  /** Disconnects from the remote host. */
  disconnect(): void
}

type MouseState = Guacamole.Mouse.State

const mouseButtonToStateProp = {
  Left: 'left',
  Middle: 'middle',
  Right: 'right',
  ScrollUp: 'up',
  ScrollDown: 'down',
} as const satisfies Record<MouseButton, keyof MouseState>

const mouseButtonProps = Object.values(mouseButtonToStateProp)

/** @see {@link Client.connect} */
export const createClient = <TKeymap extends Keymap>(
  client: Guacamole.Client,
  tunnel: Guacamole.Tunnel,
  keyboard: KeyboardMapper<TKeymap>,
  options: ClientOptions = {},
): Client<TKeymap> => {
  const { delayBetweenKeys, doubleClickDelay, toggleDelay } = {
    ...defaultOptions,
    ...options,
  }

  function translateKey(keyOrCode: string | number): number {
    return typeof keyOrCode === 'number' ? keyOrCode : keyboard.translateKey(keyOrCode)
  }

  const mouseState = MouseState()

  function setMouseButtonState(button: MouseButton, down: boolean): void {
    assert(
      Enum.isType(MouseButton, button) || mouseButtonProps.includes(button),
      `Invalid button: ${button}`,
    )
    mouseState[mouseButtonToStateProp[button] ?? button] = down
  }

  // prettier-ignore
  const CheckConnectedDecorator: Decorator = func => (...args) => {
    if (!tunnel.isConnected()) {
      throw new GuacamoleClientError('NOT_CONNECTED', 'Client is not connected')
    }
    return func(...args)
  }

  const self: Client<TKeymap> = {
    async keysPress(...keys) {
      const keysArray = unifyVarArgs(keys)

      self.keysDown(keysArray)

      if (toggleDelay > 0) {
        await delay(toggleDelay)
      }
      self.keysUp(keysArray.reverse())
    },

    async type(text) {
      for (let i = 0; i < text.length; i++) {
        const keysyms = keyboard.translateChar(text[i])

        self.keysDown(keysyms)
        await delay(toggleDelay)
        self.keysUp([...keysyms].reverse())

        if (i < text.length - 1) {
          await delay(delayBetweenKeys)
        }
      }
    },

    keysDown(...keys) {
      for (const key of unifyVarArgs(keys)) {
        client.sendKeyEvent(1, translateKey(key as string | number))
      }
    },

    keysUp(...keys) {
      for (const key of unifyVarArgs(keys)) {
        client.sendKeyEvent(0, translateKey(key as string | number))
      }
    },

    async mouseClick(button, count = 1, modifiers = []) {
      self.keysDown(modifiers)

      while (count-- > 0) {
        self.mouseButtonDown(button)
        await delay(toggleDelay)
        self.mouseButtonUp(button)

        if (count > 0) {
          await delay(doubleClickDelay)
        }
      }
      self.keysUp(modifiers)
    },

    mouseDoubleClick(button) {
      return self.mouseClick(button, 2)
    },

    async scroll(lines) {
      const button = lines > 0 ? MouseButton.ScrollUp : MouseButton.ScrollDown
      let count = Math.abs(lines)

      while (count-- > 0) {
        self.mouseButtonDown(button)
        await delay(toggleDelay)
        self.mouseButtonUp(button)

        if (count > 0) {
          await delay(toggleDelay)
        }
      }
    },

    mouseButtonDown(button) {
      setMouseButtonState(button, true)
      client.sendMouseState(mouseState)
    },

    mouseButtonUp(button) {
      setMouseButtonState(button, false)
      client.sendMouseState(mouseState)
    },

    async mouseMove(x, y) {
      assert(x >= 0, `x must be >= 0, but got: ${x}`)
      assert(y >= 0, `y must be >= 0, but got: ${x}`)

      mouseState.x = x
      mouseState.y = y
      client.sendMouseState(mouseState)
    },

    captureScreen(config) {
      const canvasElement = client.getDisplay().flatten()
      const canvas = canvasFromElement(canvasElement)

      if (canvas.width === 0 || canvas.height === 0) {
        throw new GuacamoleClientError('CANVAS_NOT_INITIALIZED', 'Canvas is not yet initialized')
      }
      return canvas.toBuffer('image/png', config)
    },

    async captureScreenToFile(filename, config) {
      const image = self.captureScreen(config)
      await FS.writeFile(filename, image)
    },

    async pause(seconds) {
      await delay(seconds * 1000)
    },

    disconnect() {
      client.disconnect()
    },
  }

  return decorateMethods(self, CheckConnectedDecorator)
}

export namespace Client {
  /**
   * Connects to `websocketUrl` (`wss://` or `ws://` scheme) and returns
   * initialized Client.
   *
   * **IMPORTANT**: You have to invoke {@link setDomGlobals} before the first
   * time you connect!
   */
  export async function connect<TKeymap extends Keymap = DefaultKeymap>(
    websocketUrl: string,
    keymap?: TKeymap,
    options: ClientOptions = {},
  ): Promise<Client<TKeymap>> {
    assert(typeof websocketUrl === 'string', `expected string, but got: ${websocketUrl}`)

    const tunnel = new Guacamole.WebSocketTunnel(websocketUrl)
    const client = new Guacamole.Client(tunnel)
    const keyboard = KeyboardMapper(keymap ?? Keymaps.US)

    await connectAsync(client)

    return createClient(client, tunnel, keyboard, options)
  }
}

function connectAsync(client: Guacamole.Client): Promise<void> {
  try {
    client.connect()
  } catch (err) {
    if (err instanceof Guacamole.Status) {
      throw new GuacamoleProtocolError(err)
    }
    throw err
  }

  return new Promise((resolve, reject) => {
    client.onstatechange = state => {
      if (state === 3 /* CONNECTED */) {
        client.onerror = null
        resolve()
      }
    }
    client.onerror = status => {
      reject(new GuacamoleProtocolError(status))
    }
  })
}

function canvasFromElement(element: HTMLCanvasElement): Canvas {
  // @ts-ignore
  return JSDOMUtils.implForWrapper(element)._getCanvas()
}

function MouseState(template?: Partial<MouseState>): MouseState {
  // @ts-ignore wrong type in @types/guacamole-common-js
  return new Guacamole.Mouse.State(template)
}

function unifyVarArgs<T extends any[]>(
  array: T & T[0][],
): T extends [any, ...infer U] ? U : never {
  if (array.length === 1 && Array.isArray(array[0])) {
    return array[0] as T[0]
  } else {
    return array as T[0]
  }
}

type Decorator = <F extends (...args: any[]) => any>(func: F) => (...args: Parameters<F>) => F

function decorateMethods<T extends object>(obj: T, decoratorFn: Decorator): T {
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const func = obj[key]
    if (typeof func === 'function') {
      ;(obj as any)[key] = decoratorFn(func as any)
    }
  }
  return obj
}
