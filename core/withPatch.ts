import { diff } from './diff'
import { singleFile } from './singleFile'
import { Filemap, FilemapPatch, Transform } from '../types'

/**
 * Creates a transform that calls the transform you provide along with a second argument: a `patch` describing the changes to the input filemap since the last time the transform was called.
 */
export const withPatch = (
  transformWithPatch: (
    input: Filemap,
    patch: FilemapPatch
  ) => Promise<Filemap> | Filemap
): Transform => {
  let previousFiles: Filemap = {}

  return singleFile((input: Filemap = {}) => {
    const patch = diff(previousFiles, input)
    previousFiles = input

    return transformWithPatch(input, patch) // satisfies Transform
  })
}
