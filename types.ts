/**
 * A plain object representing a directory of files on disk. Should always be treated as read-only.
 *
 * Every key is a root-relative file path like `index.html` or `style/main.css`. Every value is a `Buffer` containing the complete file contents.
 */
export type Snapshot = Record<string, Buffer>

/** Like a `Snapshot` but less strict - allows string and null values. */
export type Snapshottish = Record<string, Buffer | string | null | undefined>

/** Any function that receives a snapshot and returns a snapshot, either synchronously or asynchronously. */
export type StrictTransform = (
  snapshot: Snapshot,
) => Promise<Snapshot> | Snapshot

export type StrictSyncTransform = (snapshot: Snapshot) => Snapshot
export type StrictAsyncTransform = (snapshot: Snapshot) => Promise<Snapshot>

;({}) as StrictSyncTransform satisfies StrictTransform
;({}) as StrictAsyncTransform satisfies StrictTransform

/** Loose input, strict output. */
export type PermissiveTransform = (
  snapshotpish: Snapshottish,
) => Promise<Snapshot> | Snapshot

/** A loose transform function that receives a strict snapshot but may return any snapshottish object (optionally as a promise). */
export type Transformish = (
  snapshot: Snapshot,
) => Promise<Snapshottish> | Snapshottish

// /** Loose input and output. */
// export type Transformish =
//   | Transform
//   | ((snapshotpish: Snapshotpish) => Promise<Snapshotpish> | Snapshotpish)

/**
 * Object detailing the differences between two snapshots. Example use case: if you read a snapshot from disk at different times, you can use `diff` to get a patch telling you what's changed in the interim.
 *
 * New or modified files are represented with a Buffer value. Deleted files are represented with a `null` value. Unchanged files are not included in a patch.
 *
 * Note that `Snapshot` satisfies `Patch`, but the reverse is not true.
 */
export type Patch = Record<string, Buffer | null>

;({}) as Snapshot satisfies Patch
// @ts-expect-error
;({}) as Snapshottish satisfies Patch

/** A glob string, regex, or any other value that can be passed to `createMatcher` to create a matcher function. */

export type Matchable =
  string | RegExp | boolean | null | ((name: string) => any) | string[]

/** Any function that returns `true` or `false` for a given filename. */
export type Matcher = (name: string) => boolean
