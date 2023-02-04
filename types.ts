import type { z } from './deps.ts'
import { filemapSchema, filemappishSchema, matchableSchema } from './schemas.ts'

/**
 * A plain object representing a directory of files on disk. Should always be treated as read-only.
 *
 * Every key is a root-relative file path like `index.html` or `style/main.css`. Every value is a `Uint8Array` containing the complete file contents.
 */
export type Filemap = z.infer<typeof filemapSchema>

/** Like a Filemap but less strict - allows string and null values. */
export type Filemappish = z.infer<typeof filemappishSchema>

/** Any function that takes a filemap and returns a filemap, either synchronously or asynchronously. */
export type Transform = (filemap: Filemap) => Promise<Filemap> | Filemap

/**
 * Details the differences between two filemaps. Eg, if you read a filemap from disk at different times, you can use `diff` to get a patch telling you what's changed in the interim.
 *
 * New or modified files are represented with a Uint8Array value. Deleted files are represented with a `null` value. Unchanged files are not included in a patch.
 *
 * Note that `Filemap` satisfies `FilemapPatch`, but the reverse is not true.
 */
export type FilemapPatch = Record<string, Uint8Array | null>

/** A glob string, regex, or any other value that can be passed to `createMatcher` to create a matcher function. */
export type Matchable = z.infer<typeof matchableSchema>

/** Any function that returns `true` or `false` for a given filename. */
export type Matcher = (name: string) => boolean

/** Callback used for including another file during a granular build. */
export type Includer = (filename: string) => Uint8Array | null

/**
 * Return value of a `LazyBuilder` function. Specifies file(s) to output in place of the single input file.
 *
 * Meaning of each value type:
 * - `null` - exclude this file from the output
 * - `Uint8Array` or `string` - include this file in the output, with the given content
 */
export type LazyBuildresult =
  | Uint8Array
  | string
  | { [name: string]: Uint8Array | string }
  | null

/**
 * Callback function for `lazy` transforms. Determines what should be output in place of a single input file.
 */
export type LazyBuilder = (
  content: Uint8Array,
  name: string,
  include: Includer
) => LazyBuildresult
