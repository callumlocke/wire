import { Filemap, Matchable, Transform } from '../types.ts'
import { createMatcher } from './createMatcher.ts'

export const subset = (
  match: Matchable,
  transform: Transform,
  includeUnmatched = false
): Transform => {
  const matchFile = createMatcher(match)

  const subsetTransform = async (input: Filemap) => {
    const base: Filemap = {}

    // add unmatched files to base object if requested
    if (includeUnmatched) {
      for (const name of Object.keys(input))
        if (!matchFile(name)) base[name] = input[name]
    }

    // transform the files that match
    const matchingFiles = Object.keys(input)
      .filter(matchFile)
      .reduce((acc, name) => {
        acc[name] = input[name]
        return acc
      }, base)

    const output = await transform(matchingFiles)

    return output
  }

  return subsetTransform
}
