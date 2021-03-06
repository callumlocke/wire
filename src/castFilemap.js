// @flow

import * as Immutable from 'immutable'

import path from 'path'

import type { Filemap } from './types'

const memo: WeakSet<Filemap> = new WeakSet()

const blank = Immutable.Map()

/**
 * Converts any filemap-like object into a proper filemap.
 *
 * - All keys are run through `path.normlize()` to resolve any weird stuff like `..` or `//`
 * - Any string values are converted to buffers.
 * - All other values are verified to be buffers.
 * - The result is returned as an Immutable Map.
 *
 * Uses weak memoization so there is virtually zero performance penalty to re-casting something
 * that's already a filemap. So you should never inspect an object first to check if it's a filemap.
 *
 * @public
 */

const castFilemap = (files?: any): Filemap => {
  if (!files) return blank

  let result

  // return fast if we know it's a filemap already
  if (memo.has(files)) return files

  if (Immutable.Map.isMap(files)) {
    result = files
  } else if (typeof files === 'object') {
    result = Immutable.Map(files)
  } else {
    throw new TypeError('Expected files to be an Immutable Map or a plain object')
  }

  (result: Immutable.Map<string, Buffer | string>)

  // cast values to buffers
  result = result.map((content) => {
    if (typeof content === 'string') return Buffer.from(content)
    if (Buffer.isBuffer(content)) return content
    throw new TypeError('Expected all values to be strings or buffers in object passed to castFilemap')
  })

  // cast keys to normalized file paths
  result = result.mapKeys(path.normalize)
  ;(result: Filemap)

  memo.add(result)

  return result
}

export default castFilemap
