// @flow

import * as Immutable from 'immutable'
import invariant from 'invariant'

import type { FilemapLike, FilemapPatch } from './types'
import castFilemap from './castFilemap'

type SetOfFilenames = Immutable.Set<string>

/**
 * Find out the differences between two filemaps.
 */

const diff = (_input: FilemapLike, _output: FilemapLike): FilemapPatch => {
  const input = castFilemap(_input)
  const output = castFilemap(_output)

  const inputKeys: SetOfFilenames = Immutable.Set.fromKeys(input.toJS())
  const outputKeys: SetOfFilenames = Immutable.Set.fromKeys(output.toJS())

  // start with a blank map
  let changes: FilemapPatch = Immutable.Map()

  // include any output files that are newly created/modified
  for (const outputKey of outputKeys) {
    const outputValue = output.get(outputKey)
    const inputValue = input.get(outputKey)

    invariant(outputValue, 'outputKey is known to exist in output filemap')

    if (!inputValue || !outputValue.equals(inputValue)) {
      changes = changes.set(outputKey, outputValue)
    }
  }

  // add nulls to indicate deleted files
  for (const inputKey of inputKeys) {
    if (!output.has(inputKey)) changes = changes.set(inputKey, null)
  }

  return changes
}

export default diff
