import { pathUtil } from '../deps.ts'

import type { Filemap, Filemappish } from '../types.ts'

const blank: Filemap = {}
const memo: WeakSet<Filemap> = new WeakSet([blank])
const encoder = new TextEncoder()

/**
 * Casts any filemappish object to a proper filemap - by normalising keys as POSIX-style paths, ensuring all values are Uint8Arrays (converting from strings where necessary), and freezing the returned object.
 */

export const castFilemap = (files: Filemappish = blank): Filemap => {
  if (memo.has(files as Filemap)) return files as Filemap

  if (typeof files !== 'object') {
    throw new TypeError('Expected files to be an object')
  }

  const result: Record<string, Uint8Array> = {}

  for (const key in files) {
    const originalValue = files[key]
    let newValue: Uint8Array
    if (typeof originalValue === 'string')
      newValue = encoder.encode(originalValue)
    else if (originalValue instanceof Uint8Array) newValue = originalValue
    else if (originalValue === null || originalValue === undefined) continue
    else {
      throw new TypeError(
        'castFilemap: Expected every value to be a string, Uint8Array, null or undefined'
      )
    }

    result[pathUtil.normalize(key)] = newValue
  }

  Object.freeze(result)

  memo.add(result)

  return result
}
