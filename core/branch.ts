/**
 * Creates a transform that runs multiple transforms in parallel on different subsets of the input and then merges the results. Takes a `transforms` object, the keys of which are globs, and the values of which are transforms to apply to whichever files match those globs.
 *
 * Branches are exclusive. If a file matches the first key, it won't be included in the second key's subset.
 *
 * Merging works like this: if a file is present in multiple outputs, the last one wins.
 *
 * NB. key order is standardised as of ES2015: https://stackoverflow.com/a/5525820
 * (respects the order, except for number-like keys)
 *
 * This is very similar to subset, except that it only takes glob strings, not any Matchable, so it can offer a more readable syntax for cases where you want to do a few things in parallel.
 */

import { createMatcher } from '..'
import { Filemap, Transform } from '../types'

export const branch =
  (transforms: Record<string, Transform>, keepUnmatched = true): Transform =>
  async (input: Filemap) => {
    const output: Filemap = {}
    await Promise.resolve()

    let inputFiles = Object.keys(input)
    const jobs: Record<string, Promise<Filemap>> = {}

    for (const glob of Object.keys(transforms)) {
      const match = createMatcher(glob)
      const matchedFiles = inputFiles.filter((name) => match(name))

      // exclude matched files from the next glob
      inputFiles = inputFiles.filter((name) => !matchedFiles.includes(name))
      const files = matchedFiles.reduce((acc, name) => {
        acc[name] = input[name]
        return acc
      }, {} as Filemap)

      jobs[glob] = Promise.resolve(transforms[glob](files))
    }

    await Promise.all(Object.values(jobs))

    // merge them in same order
    for (const glob of Object.keys(transforms)) {
      Object.assign(output, await jobs[glob])
    }

    if (keepUnmatched) {
      // add the files that didn't match any glob, but also weren't output by a transform
      for (const name of inputFiles) {
        if (!output[name]) output[name] = input[name]
      }
    }

    return output
  }
