// Enum is based on typescript-string-enums.

/** @private */
export type Enum<T extends Record<string, string>> = T[keyof T]

// @internal
export function Enum<V extends string>(...values: V[]): Readonly<{ [K in V]: K }> {
  const obj = values.reduce((acc, value) => {
    acc[value] = value
    return acc
  }, {} as any)
  return Object.freeze(obj)
}

// @internal
export namespace Enum {
  export function isType<T extends { [_: string]: any }>(e: T, value: any): value is Enum<T> {
    return Object.keys(e).includes(value)
  }
}

/** @private Type of the `Object.entries()` return value. */
export type Entries<T> = { [K in keyof T]: [K, T[K]] }[keyof T][]

/** @internal Converts camelCase to kebab-case. */
export function camelToKebab(str: string): string {
  return str
    .replace(/([a-z])([A-Z0-9])/g, '$1-$2')
    .replace(/([0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

/** @internal Returns a copy of the given `obj` without keys which value is `undefined`. */
export function omitUndefined<T extends Record<PropertyKey, any>>(obj: T): T {
  return Object.entries(obj).reduce((acc, [key, val]) => {
    if (val !== undefined) {
      acc[key] = val
    }
    return acc
  }, {} as any)
}

/** @internal Wraps `text` to lines with `maxWidth`. */
export function wrapText(text: string, maxWidth: number): string[] {
  const lines = []
  let curLine = ''
  for (const word of text.split(' ')) {
    if (word.length > maxWidth - curLine.length) {
      lines.push(curLine.trimEnd())
      curLine = ''
    }
    curLine += `${word} `
  }
  lines.push(curLine.trimEnd())

  return lines
}
