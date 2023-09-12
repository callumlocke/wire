import pathUtil from 'node:path'

import type { Filemap, Filemappish } from '../types'

const blank: Filemap = {}
const memo: WeakSet<Filemap> = new WeakSet([blank])

/**
 * Casts any filemappish object to a proper filemap - by normalising keys as POSIX-style paths, ensuring all values are Buffers (converting from strings where necessary), and freezing the returned object.
 */

export const castFilemap = (files: Filemappish = blank): Filemap => {
  if (memo.has(files as Filemap)) return files as Filemap

  if (typeof files !== 'object') {
    throw new TypeError('Expected files to be an object')
  }

  const result: Record<string, Buffer> = {}

  for (const key in files) {
    const originalValue = files[key]
    let newValue: Buffer
    if (typeof originalValue === 'string') newValue = Buffer.from(originalValue)
    else if (Buffer.isBuffer(originalValue)) newValue = originalValue
    else if (originalValue === null || originalValue === undefined) continue
    else {
      throw new TypeError(
        'castFilemap: Expected every value to be a string, Buffer, null or undefined'
      )
    }

    result[pathUtil.normalize(key)] = newValue
  }

  Object.freeze(result)

  memo.add(result)

  return result
}
