import '@types/guacamole-common-js'

// Augment guacamole-common-js types to fix errors.
declare module 'guacamole-common-js' {
  interface Display {
    flatten(): HTMLCanvasElement
  }

  // This class is completely missing.
  /** A position in 2-D space. */
  class Position {
    /**
     * The current X position, in pixels.
     * @default 0
     */
    x: number
    /**
     * The current Y position, in pixels.
     * @default 0
     */
    y: number

    /**
     * @param template The object whose properties should be copied within the
     * new {@link Position}.
     */
    constructor(template?: Partial<Position>)

    /**
     * Returns a new {@link Position} representing the relative position of
     * the given clientX/clientY coordinates within the given element. The
     * clientX and clientY coordinates are relative to the browser viewport
     * and are commonly available within JavaScript event objects. The final
     * position is translated to  coordinates that are relative the given
     * element.
     */
    fromClientPosition(element: Element, clientX: number, clientY: number): Position
  }

  namespace Mouse {
    /** All mouse buttons that may be represented by a {@link Mouse.State}. */
    enum Buttons {
      /**
       * The name of the {@link Mouse.State} property representing the
       * left mouse button.
       */
      LEFT = 'left',
      /**
       * The name of the {@link Mouse.State} property representing the
       * middle mouse button.
       */
      MIDDLE = 'middle',
      /**
       * The name of the {@link Mouse.State} property representing the
       * right mouse button.
       */
      RIGHT = 'right',
      /**
       * The name of the {@link Mouse.State} property representing the
       * up mouse button (the fourth mouse button, clicked when the mouse scroll
       * wheel is scrolled up).
       */
      UP = 'up',
      /**
       * The name of the {@link Mouse.State} property representing the
       * down mouse button (the fifth mouse button, clicked when the mouse scroll
       * wheel is scrolled up).
       */
      DOWN = 'down',
    }
  }
}
