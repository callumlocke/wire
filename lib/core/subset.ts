import { Filemap, Matchable, Transform } from '../types.ts'
import { createMatcher } from './createMatcher.ts'

export const subset = (
  match: Matchable,
  transform: Transform,
  keepUnmatched = true
): Transform => {
  const matchFile = createMatcher(match)

  const subsetTransform = async (input: Filemap) => {
    const matchingFiles = Object.keys(input)
      .filter(matchFile)
      .reduce((acc, name) => {
        acc[name] = input[name]
        return acc
      }, {} as Filemap)

    const output = await transform(matchingFiles)

    // add unmatched files to output, unless output includes them
    if (keepUnmatched) {
      for (const name of Object.keys(input))
        if (!matchFile(name) && !output[name]) output[name] = input[name]
    }

    return output
  }

  return subsetTransform
}
