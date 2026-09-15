import pathUtil from 'node:path'

import type { Snapshot, Snapshottish } from '../types'

const blank: Snapshot = {}
const memo: WeakSet<Snapshot> = new WeakSet([blank])

/**
 * Casts any `Snapshottish` object to a strict `Snapshot`.
 * - Normalises keys as POSIX-style paths,
 * - ensures all values are Buffers (converting strings, skipping null/undefined), and
 * - freezes the returned object.
 */

export const castSnapshot = (files: Snapshottish = blank): Snapshot => {
  if (memo.has(files as Snapshot)) return files as Snapshot

  if (typeof files !== 'object')
    throw new TypeError('Expected files to be an object')

  const result: Record<string, Buffer> = {}

  for (const key in files) {
    const originalValue = files[key]
    let newValue: Buffer
    if (typeof originalValue === 'string') newValue = Buffer.from(originalValue)
    else if (Buffer.isBuffer(originalValue)) newValue = originalValue
    else if (originalValue == null) continue
    else {
      throw new TypeError(
        'castSnapshot: Expected every value to be a string, Buffer, null or undefined',
      )
    }

    let normalPath = pathUtil.normalize(key)
    if (normalPath[0] === '/')
      throw new Error(
        `Bad snapshot key (absolute pathname): ${JSON.stringify(key)}`,
      )
    else if (normalPath.startsWith(`../`))
      throw new Error(`Bad snapshot key (outside root): ${JSON.stringify(key)}`)

    result[normalPath] = newValue
  }

  Object.freeze(result)

  memo.add(result)

  return result
}
