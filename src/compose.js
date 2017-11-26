// @flow

import { Map as ImmutableMap } from 'immutable'

import type { PermissiveTransform, LooseTransform } from './types'
import castFilemap from './castFilemap'

/**
 * Compose a list of transforms into a single transform that runs as an asynchronous series of
 * steps.
 *
 * Also casts to filemap before and after each step, so your transforms may be 'loose' if need be.
 * @public
 */

const compose = (...fns: Array<LooseTransform | null>): PermissiveTransform => {
  const composedTransform = async (_files) => {
    let files = _files || ImmutableMap()

    for (const fn of fns) {
      if (!fn) continue

      files = castFilemap(files)

      files = await Promise.resolve(fn(files))
    }

    return castFilemap(files)
  }

  return composedTransform
}

export default compose
