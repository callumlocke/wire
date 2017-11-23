// @flow

import { compose, castFilemap, createMatcher } from '.'
import type { Matchable, Transform, AsyncTransform } from '.'

/**
 * Creates an asynchronous transform that will apply the given `transforms` to only a subset of
 * incoming files. Files outside this subset are kept aside and then recombined with the output
 * files at the end before finally returning them.
 */

export default function withSubset(
  pattern: Matchable,
  ...transforms: Transform[]
): AsyncTransform {
  if (!transforms.length) return async files => files

  // precompile a matcher for repeat unselected
  const match = createMatcher(pattern)

  // compose the passed transforms into a single transform
  const transform = compose(...transforms)

  // return a transform that only operates on files that match the matcher
  return async (files) => {
    const filesObject = castFilemap(files).toObject()
    const names = Object.keys(filesObject)
    const count = names.length

    // sort them into selected and unselected
    const selectedFiles = {}
    const unselectedFiles = {}
    for (let i = 0; i < count; i += 1) {
      const name = names[i]
      const group = match(name) ? selectedFiles : unselectedFiles
      group[name] = filesObject[name]
    }

    // transform the selected subset
    const selectedOutput = await transform(selectedFiles)

    // merge the unselected files into the output
    return castFilemap(selectedOutput.merge(unselectedFiles))
  }
}
