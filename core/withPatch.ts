import { diff } from './diff'
import { singleFile } from './lib/singleFile'
import type { Snapshot, Patch, StrictTransform } from '../types'

/**
 * Creates a transform that calls the transform you provide along with a second argument: a `Patch` describing the changes to the input since the last time the transform was called. Single concurrency is enforced.
 */
export const withPatch = (
  transformWithPatch: (
    input: Snapshot,
    patch: Patch,
  ) => Promise<Snapshot> | Snapshot,
): StrictTransform => {
  let previousFiles: Snapshot = {}

  const transform = (input: Snapshot = {}) => {
    const patch = diff(previousFiles, input)
    previousFiles = input

    return transformWithPatch(input, patch)
  }

  return singleFile(transform)
}
