import type { Snapshottish, Patch } from '../types'
import { castSnapshot } from './castSnapshot'

/**
 * Get an object detailing the differences between two snapshots, `input` and `output`.
 *
 * The resulting object contains keys only of new, modified or deleted files. The value is a buffer for new and changed files, or `null` to indicate a deleted file. An empty object (`{}`) means no changes.
 */

export const diff = (
  input: Snapshottish,
  output: Snapshottish,
): Readonly<Patch> => {
  const inputSnapshot = castSnapshot(input)
  const outputSnapshot = castSnapshot(output)

  // start with a blank map
  const changes: Patch = {}

  // include any output files that are newly created/modified
  for (const [outputKey, outputValue] of Object.entries(outputSnapshot)) {
    const inputValue = inputSnapshot[outputKey]

    if (!inputValue || !outputValue.equals(inputValue))
      changes[outputKey] = outputValue
  }

  // add nulls to indicate deleted files
  for (const inputKey of Object.keys(inputSnapshot))
    if (!outputSnapshot[inputKey]) changes[inputKey] = null

  return Object.freeze(changes)
}
