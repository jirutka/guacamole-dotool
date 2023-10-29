import { Image } from 'canvas'
import { JSDOM } from 'jsdom'
import { WebSocket } from 'ws'

/**
 * Sets `canvas`, `jsdom`, and `ws` to the `global` context - `window`,
 * `document`, `Image` and `WebSocket`. These are required by the
 * `guacamole-common-js` library.
 */
export function setDomGlobals(aGlobal: typeof globalThis = global) {
  const { window } = new JSDOM('<!doctype html><html><body></body></html>', {
    resources: 'usable',
  })
  aGlobal.window = window as any
  aGlobal.document = window.document
  aGlobal.Image = Image as any
  aGlobal.WebSocket = WebSocket as any
}
