import { createMatcher } from './createMatcher.ts'
import { Filemap, Matchable } from '../types.ts'

/**
 * Filters a filemap by filename.
 */
export const filterFiles = (files: Filemap, filter: Matchable): Filemap => {
  const match = createMatcher(filter)

  const output: Filemap = {}

  for (const [name, content] of Object.entries(files))
    if (match(name)) output[name] = content

  return output
}
