import { promises as fs } from 'fs'

/**
 * Ensures that a directory exists at the given path. Conceptually similar to `mkdir -p`.
 */

export const ensureDir = async (dir: string): Promise<void> => {
  try {
    const stat = await fs.stat(dir)
    if (!stat.isDirectory())
      throw new Error('File already exists at path and is not a directory')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      await fs.mkdir(dir, { recursive: true })
    else throw error
  }
}
