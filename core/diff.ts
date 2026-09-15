import type { Snapshottish, FilemapPatch } from '../types'
import { castSnapshot } from './castSnapshot'

/**
 * Get an object detailing the differences between two filemaps, `input` and `output`.
 *
 * The resulting object contains keys only of new, modified or deleted files. The value is a buffer for new and changed files, or `null` to indicate a deleted file. An empty object (`{}`) means no changes.
 */

export const diff = (
  input: Snapshottish,
  output: Snapshottish
): Readonly<FilemapPatch> => {
  const inputFilemap = castSnapshot(input)
  const outputFilemap = castSnapshot(output)

  // start with a blank map
  const changes: FilemapPatch = {}

  // include any output files that are newly created/modified
  for (const [outputKey, outputValue] of Object.entries(outputFilemap)) {
    const inputValue = inputFilemap[outputKey]

    if (!inputValue || !outputValue.equals(inputValue))
      changes[outputKey] = outputValue
  }

  // add nulls to indicate deleted files
  for (const inputKey of Object.keys(inputFilemap))
    if (!outputFilemap[inputKey]) changes[inputKey] = null

  return Object.freeze(changes)
}
