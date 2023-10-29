import { Enum } from './utils.js'

export const MouseButton = Enum('Left', 'Middle', 'Right', 'ScrollUp', 'ScrollDown')
export type MouseButton = Enum<typeof MouseButton>
