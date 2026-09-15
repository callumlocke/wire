import { diff } from './diff'
import { singleFile } from './singleFile'
import type { Snapshot, FilemapPatch, StrictTransform } from '../types'

/**
 * Creates a transform that calls the transform you provide along with a second argument: a `FilemapPatch` describing the changes to the input filemap since the last time the transform was called. Single concurrency is enforced.
 */
export const withPatch = (
  transformWithPatch: (
    input: Snapshot,
    patch: FilemapPatch,
  ) => Promise<Snapshot> | Snapshot,
): StrictTransform => {
  let previousFiles: Snapshot = {}

  const transform = (input: Snapshot = {}) => {
    const patch = diff(previousFiles, input)
    previousFiles = input

    return transformWithPatch(input, patch) // satisfies Transform
  }

  return singleFile(transform)
}
