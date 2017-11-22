import { identity } from 'lodash'

import { compose, castFilemap, createMatcher } from '../src'

export default function withSubset(pattern, ...transforms) {
  if (!transforms.length) return identity

  // precompile a matcher for repeat unselected
  const match = createMatcher(pattern)

  // compose the passed transforms into a single transform
  const transform = compose(...transforms)

  // return a transform that only operates on files that match the matcher
  return async (_files) => {
    const files = castFilemap(_files).toObject()
    const names = Object.keys(files)
    const count = names.length

    // sort them into selected and unselected
    const selectedFiles = {}
    const unselectedFiles = {}
    for (let i = 0; i < count; i += 1) {
      const name = names[i]
      const group = match(name) ? selectedFiles : unselectedFiles
      group[name] = files[name]
    }

    // transform the selected subset
    const selectedOutput = await transform(selectedFiles)

    // merge the unselected files into the output
    return castFilemap(selectedOutput.merge(unselectedFiles))
  }
}
