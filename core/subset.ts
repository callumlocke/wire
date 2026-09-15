import type {
  Snapshot,
  Matchable,
  StrictTransform,
  Transformish,
} from '../types'
import { castSnapshot } from './castSnapshot'
import { createMatcher } from './createMatcher'

export const subset = (
  match: Matchable,
  transform: Transformish,
  keepUnmatched = true
): StrictTransform => {
  const matchFile = createMatcher(match)

  const subsetTransform = async (input: Snapshot) => {
    const matchingFiles = Object.keys(input)
      .filter(matchFile)
      .reduce((acc, name) => {
        acc[name] = input[name]!
        return acc
      }, {} as Snapshot)

    const output = await transform(matchingFiles)

    // add unmatched files to output, unless output includes them
    if (keepUnmatched)
      for (const name of Object.keys(input))
        if (!output[name] && !matchFile(name)) output[name] = input[name]!

    return castSnapshot(output)
  }

  return subsetTransform
}
