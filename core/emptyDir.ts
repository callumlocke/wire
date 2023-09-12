import { promises as fs } from 'fs'
import pathUtil from 'path'

/**
 * Clears a directory out so it's empty, or creates it if it doesn't exist. Errors if a non-directory file already exists at the path
 */

export async function emptyDir(dir: string) {
  let items: string[]

  try {
    items = await fs.readdir(dir)
  } catch (error) {
    // @ts-ignore
    if (error?.code === 'ENOENT') {
      // Path does not exist - create a directory there and we are done
      await fs.mkdir(dir, { recursive: true })
      return
    }

    // Some other error (e.g. path is something other than a directory) - rethrow
    throw error
  }

  // Directory already exists - delete any items found in it
  while (items.length) {
    const item = items.shift()
    if (item) {
      const filepath = pathUtil.join(dir, item)
      await fs.rm(filepath, { recursive: true })
    }
  }
}
