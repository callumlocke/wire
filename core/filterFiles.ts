import { createMatcher } from './createMatcher'
import type { Snapshot, Matchable } from '../types'

/**
 * Filters a snapshot by checking the keys agasint the given `filter`.
 */
export const filterFiles = (files: Snapshot, filter: Matchable): Snapshot => {
  const match = createMatcher(filter)

  const output: Snapshot = {}

  for (const [name, content] of Object.entries(files))
    if (match(name)) output[name] = content

  return output
}
