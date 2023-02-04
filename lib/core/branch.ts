/**
 * Creates a transform that runs multiple transforms in parallel on different subsets of the input and then merges the results.
 *
 * Subsets are exclusive. If a file matches the first key, it won't be included in the second key's subset.
 *
 * Merging works like this: if a file is present in multiple outputs, the last one wins.
 *
 * NB. key order is standardised as of ES2015: https://stackoverflow.com/a/5525820
 * (respects the order, except for number-like keys)
 *
 * This is like subset, except that it only takes globs, not any Matchable.
 */

import { pathUtil } from '../deps.ts'
import { Filemap, Transform } from '../types.ts'

export const branch =
  (transforms: Record<string, Transform>, includeUnmatched = true): Transform =>
  async (input: Filemap) => {
    const output: Filemap = {}
    await Promise.resolve()

    let inputFiles = Object.keys(input)
    const jobs: Record<string, Promise<Filemap>> = {}

    for (const glob of Object.keys(transforms)) {
      const matchedFiles = inputFiles.filter((name) =>
        pathUtil.globToRegExp(glob).test(name)
      )

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

    if (includeUnmatched) {
      // add the files that didn't match any glob
      for (const name of inputFiles) {
        output[name] = input[name]
      }
    }

    return output
  }
