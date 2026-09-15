import path from 'node:path'

/** Returns true if `dirPath` is an ancestor of `possibleSubPath` (only comparing path strings, not checking the filesystem). */

export const dirContains = (
  dirPath: string,
  possibleSubPath: string,
): boolean => {
  const relative = path.relative(dirPath, possibleSubPath)
  return (
    relative.length > 0 &&
    !relative.startsWith('..') &&
    !path.isAbsolute(relative)
  )
}
