// deno-lint-ignore-file no-explicit-any
import { fs, pathUtil, colors, debounce } from '../deps.ts'
import { Filemap, Filemappish, Matchable, Matcher } from '../types.ts'
import { createMatcher } from './createMatcher.ts'
import { parseFilesize } from './parseFilesize.ts'
import { diff } from './diff.ts'
import { castFilemap } from './castFilemap.ts'

const dirContainsPath = (parent: string, possibleDescendentPath: string) => {
  const relative = pathUtil.relative(parent, possibleDescendentPath)
  return (
    relative && !relative.startsWith('..') && !pathUtil.isAbsolute(relative)
  )
}

export type DirectoryOptions = {
  match: Matchable
  limit: string
  log: ((...args: any[]) => any) | boolean
  emitWatchErrors: boolean
  logWatchErrors: boolean
  force: boolean
}

const defaults: DirectoryOptions = {
  match: true,
  limit: '10MB',
  log: false,
  emitWatchErrors: false,
  logWatchErrors: true,
  force: false,
}

/*
  After `file` has been deleted, this is called to also delete its directory if now empty. Continues deleting parent directories until it encounters one that is not empty.
*/
async function pruneEmptyAncestors(file: string, until: string) {
  if (until === file || !dirContainsPath(until, file)) return

  const parent = pathUtil.dirname(file)

  // TODO investigate: can we do this, to avoid final (failed?) removal-attempt of `dist`? Or does it not do one anyway?
  // if (parent === until || !dirContainsPath(until, parent)) return

  // Attempt to remove the directory (if it has contents, this will correctly fail and recursion will end)
  try {
    await Deno.remove(parent)
  } catch (error: unknown) {
    // if it's just a non-empty or missing directory, swallow error and end recursion
    if (
      error instanceof Error &&
      typeof error.message === 'string' &&
      // TODO better way to detect this error
      (error.message.startsWith('Directory not empty') ||
        error instanceof Deno.errors.NotFound)
    ) {
      return
    }

    // Unexpected type of error
    throw error
  }

  await pruneEmptyAncestors(parent, until)
}

/**
 * Syncs with a directory on disk with in-memory filemaps.
 */
export class Directory {
  private absolutePath: string
  private match: Matcher
  private limit: number
  private log: (...args: any[]) => void
  private logWatchErrors: boolean
  private emitWatchErrors: boolean
  private logPrelude: string
  private watcher: null | Deno.FsWatcher
  private primed: boolean
  private files: Record<string, Uint8Array>
  private mtimes: Record<string, number>
  private queuedOperations: Promise<any>
  private subscriber: null | Promise<Filemap>

  get path() {
    return this.absolutePath
  }

  constructor(name: string, partialOptions?: Partial<DirectoryOptions>) {
    const options: DirectoryOptions = { ...defaults, ...partialOptions }

    this.absolutePath = pathUtil.resolve(name)
    this.match = createMatcher(options.match)
    this.limit = parseFilesize(options.limit)

    if (typeof options.log === 'function') {
      this.log = options.log
    } else {
      this.log = options.log ? (...args) => console.log(...args) : () => {}
    }

    this.logWatchErrors = Boolean(options.logWatchErrors)
    this.emitWatchErrors = Boolean(options.emitWatchErrors)
    this.logPrelude =
      pathUtil.relative(Deno.cwd(), this.absolutePath) + pathUtil.sep

    this.queuedOperations = Promise.resolve()

    if (
      options.force !== true &&
      !dirContainsPath(Deno.cwd(), this.absolutePath)
    ) {
      throw new Error(
        'wire Directory: Cannot work outside CWD unless you set force:true'
      )
    }

    this.watcher = null
    this.subscriber = null // callback to call on watch events
    this.primed = false // whether there's anything in the cache

    // intialise caches
    this.files = {} // [fileName: content]
    this.mtimes = {} // [fileName: mtime]

    // bind public methods to `this`
    this.read = this.read.bind(this)
    this.write = this.write.bind(this)
    this.watch = this.watch.bind(this)
    this.close = this.close.bind(this)
    this.getCache = this.getCache.bind(this)
  }

  /**
   * Update the in-memory filemap to match the real files on disk, if changed.
   */
  private async reprime() {
    // on first call, ensure the directory exists
    if (!this.primed) await fs.ensureDir(this.absolutePath)

    // start the new files and mtimes caches (eventually to replace this.files and this.mtimes)
    const files: Record<string, Uint8Array> = {}
    const mtimes: Record<string, number> = {}

    // let totalSize = 0 // TODO

    // Walk to get all the files
    let index = 0
    const paths = []
    const contentsPromises = []

    for await (const entry of fs.walk(this.absolutePath, {
      includeDirs: false,
    })) {
      paths[index] = pathUtil.relative(this.absolutePath, entry.path)
      contentsPromises[index] = Deno.readFile(entry.path) // TODO only if mtime changed (like in Node version)
      index++
    }

    const contents = await Promise.all(contentsPromises)

    // const files: Filemap = {}
    for (let i = 0; i < paths.length; i++) {
      files[paths[i]] = contents[i]
    }

    // TODO: perf: instead of just waiting for the recursive readdir every time, try immediately looking up known files to see if they still exist.

    // save the new caches and note that the directory has been primed
    this.files = files
    this.mtimes = mtimes
    this.primed = true
  }

  /**
   * Queues function to be called after any other functions already in the queue.
   */
  private queue<R>(queuableFunction: () => R | Promise<R>): Promise<R> {
    const result = Promise.resolve(this.queuedOperations).then(() =>
      queuableFunction()
    )

    this.queuedOperations = result

    return result
  }

  /**
   * Gets the contents of the directory as a filemap - from the in-memory cache
   * if possible, otherwise from disk.
   */
  public read(incomingFiles?: Filemap): Promise<Filemap> {
    return this.queue(async () => {
      if (this.watcher) return this.files // TODO await first read from .watch()

      await this.reprime()

      // merge over any incoming files (which may exist if this read() is being used as a transform)
      if (incomingFiles) {
        return {
          ...castFilemap(incomingFiles),
          ...this.files,
        }
      }

      // return the map of files
      return this.files
    })
  }

  /**
   * Writes the given files to the directory on disk.
   */
  public write(incomingFiles: Filemappish): Promise<Filemap> {
    return this.queue(async () => {
      if (this.watcher)
        throw new Error('wire: Refusing to write to watched directory')

      // [re]prime this directory, unless it's being kept up to date automatically
      if (!this.watcher) await this.reprime()

      // see what changes are needed
      const patch = diff(this.files, incomingFiles)
      const patchKeys = Object.keys(patch)

      // start some mutatable objects based on our existing caches (eventually to replace them)
      const newFiles: { [name: string]: Uint8Array } = { ...this.files }
      const newMtimes = { ...this.mtimes }

      // note deleted paths (so we can prune empty dirs after deleting the files)
      const deletions = new Set<string>()

      // go through all patch paths in parallel

      await Promise.all(
        patchKeys.map(async (name) => {
          const content = patch[name] as Uint8Array | null // cannot be undefined

          if (content === null) {
            // the patch says we should delete this file.
            deletions.add(name)
            delete newFiles[name]

            // delete the file from disk
            await Deno.remove(pathUtil.join(this.absolutePath, name))

            this.log(` → delete ${this.logPrelude}${name}`)
          } else {
            // the patch says this file has changed.
            // write the file to disk
            await fs.ensureDir(
              pathUtil.dirname(pathUtil.join(this.absolutePath, name))
            ) // TODO is this nec in Deno?
            await Deno.writeFile(
              pathUtil.join(this.absolutePath, name),
              content
            )

            this.log(` →  write ${this.logPrelude}${name}`)

            // then set our new caches
            newMtimes[name] = Date.now() // nb. must record time after writing, not before
            newFiles[name] = content
          }
        })
      )

      // now all files are deleted, prune any empty directories in series
      for (const deletion of deletions) {
        await pruneEmptyAncestors(
          pathUtil.resolve(this.absolutePath, deletion),
          this.absolutePath
        )
      }

      // update our files cache
      this.files = newFiles
      this.mtimes = newMtimes

      return newFiles
    })
  }

  /**
   * Starts watching the directory on disk, and calls your subscriber with a new filemap whenever something has changed.
   *
   * Returns a promise that resolves after the first call to your subscriber (and after resolution of any promise returned by your subscriber, if applicable).
   */
  public watch(
    onFilemapChange: (filemap: Filemap) => any
    // options?:
  ): Promise<void> {
    return this.queue((): Promise<void> => {
      if (this.watcher) throw new Error('Already watching')

      return new Promise((resolve, reject) => {
        const notify = debounce(() => {
          const currentSubscriber: Promise<any> =
            this.subscriber || Promise.resolve()

          this.subscriber = currentSubscriber
            .then(() => onFilemapChange(this.files))
            .catch((error) => {
              if (this.logWatchErrors) {
                console.error(
                  colors.red('wire Directory: error from watch subscriber')
                )
                console.error(error)
              }

              if (this.emitWatchErrors) {
                console.error('NOT IMPLEMENTED: emitWatchErrors')
                throw error
              }
            })
        }, 10)

        // create the watcher
        this.watcher = Deno.watchFs(this.absolutePath, { recursive: true })

        // read the initial contents from disk, and wait for it
        return this.reprime().then(async () => {
          // call callback once on startup with initial contents, and resolve this queue item once the callback is done
          Promise.resolve(notify()).then(() => resolve())

          // wait for fs events in the background
          try {
            for await (const { paths } of this.watcher!) {
              // figure out change types (`event.kind` is not very reliable IRL)
              const changeTypes = await Promise.all(
                paths.map(async (path) => {
                  try {
                    const stat = await Deno.stat(path)
                    return stat.isFile ? 'written' : 'removed'
                  } catch (_error) {
                    return 'removed'
                  }
                })
              )

              // TODO figure out if safe to do all fs ops in parallel promises and notify once after all of them
              let i = 0
              for (const absolutePath of paths) {
                const path = pathUtil.relative(this.absolutePath, absolutePath)
                if (!this.match(path)) continue

                const kind = changeTypes[i++]

                switch (kind) {
                  case 'removed':
                    this.log('remove', this.logPrelude + path)
                    delete this.files[path]
                    delete this.mtimes[path]
                    notify()
                    break
                  case 'written':
                    this.log(kind, this.logPrelude + path)
                    this.mtimes[path] = Date.now()
                    this.files[path] = await Deno.readFile(
                      pathUtil.join(this.absolutePath, path)
                    )
                    notify()
                    break
                  default:
                    throw new Error('unhandled kind: ' + kind)
                }
              }
            }
          } catch (error) {
            reject(error)
          }
        })
      })
    })
  }

  /**
   * Stops watching the directory.
   */
  public close() {
    if (!this.watcher) throw new Error('wire: no watcher to close')
    return this.watcher.close.call(this.watcher)
  }

  /**
   * Synchronous method to retrieve the files cache as it stands, without revalidating
   * against the disk. Throws if the directory has never been primed.
   */
  public getCache(): Filemap {
    if (!this.primed)
      throw new Error('wire: This Directory instance has never been primed.')

    return this.files
  }
}
