// @flow

import { debounce } from 'lodash'
import { grey, red } from 'chalk'
import Bluebird from 'bluebird'
import * as Immutable from 'immutable'
import mkdirp from 'mkdirp-promise'
import parseFilesize from 'filesize-parser'
import prettyBytes from 'pretty-bytes'
import sane from 'sane'
import subdir from 'subdir'

import { promisify } from 'util'
import EventEmitter from 'events'
import fs from 'fs'
import path from 'path'

import type { Matcher, Filemap, FilemapLike } from './types'
import castFilemap from './castFilemap'
import createMatcher from './createMatcher'
import diff from './diff'

const lstat = promisify(fs.lstat)
const readdir = promisify(fs.readdir)
const readFile = promisify(fs.readFile)
const rmdir = promisify(fs.rmdir)
const unlink = promisify(fs.unlink)
const writeFile = promisify(fs.writeFile)

const defaults = {
  match: '**',
  limit: '10MB',
  log: false,
  emitWatchErrors: false,
  logWatchErrors: true,
}

/**
 * Slightly hacky. After `file` has been deleted, this is called to also delete its directory if
 * that directory is now empty. Continues deleting parent directories until it encounters one that
 * is not empty.
 */

async function pruneEmptyAncestors(file, until) {
  if (until === file || !subdir(until, file)) return

  const parent = path.dirname(file) // eslint-disable-line no-param-reassign

  try {
    await rmdir(parent)
  } catch (error) {
    // for non-empty or missing directories, quietly finish
    if (error.code === 'ENOTEMPTY' || error.code === 'ENOENT') return
    throw error
  }

  await pruneEmptyAncestors(parent, until)
}

/**
 * Mutates the passed dir instance by [re]priming its caches to match the real
 * files on disk.
 */

async function reprime(dir) {
  // start the new files and mtimes caches (eventually to replace the ones on the object)
  const files = {}
  const mtimes = {}

  // define resursive function to load directory contents
  let totalSize = 0
  const load = dirName =>
    Bluebird.map(readdir(dirName), async (_name) => {
      const name = path.resolve(dirName, _name)
      const relativeName = path.relative(dir._absolutePath, name)

      // find out when the file last changed on disk
      const stat = await lstat(name)
      const diskMtime = stat.mtime.getTime()

      // find out when our cached copy last changed (if any)
      const lastKnownMtime = dir._mtimes.get(relativeName)

      if (stat.isFile()) {
        // skip this file if it's excluded by the matcher
        if (!dir._match(relativeName)) return

        // get the cached content (if any)
        const cachedContent = dir._files.get(relativeName)

        // decide what we're going to go with (the one from the cache or the one on disk)
        let content
        let mtime
        // console.log('\nfile', name);
        // console.log('  lastKnownMtime', lastKnownMtime);
        // console.log('       diskMtime', diskMtime);
        // console.log();

        if (cachedContent && diskMtime <= lastKnownMtime) {
          // cached file exists and is new enough; use it
          // console.log('cache hit!!', relativeName);
          mtime = lastKnownMtime
          content = cachedContent
        } else {
          // no cached file (or too old); read the file from disk
          // console.log('cache miss:', relativeName);
          mtime = diskMtime
          content = await readFile(name)
        }

        // verify adding this file doesn't take us over the filesize limit
        totalSize += content.length
        if (totalSize > dir._limit) {
          throw new Error(`Contents of directory exceed ${prettyBytes(dir._limit)} limit: ${
            dir._absolutePath
          }`)
        }

        // update the new caches with this file's content and mtime
        files[relativeName] = content
        mtimes[relativeName] = mtime
      } else if (stat.isDirectory()) {
        // recurse into it
        await load(name)
      } else if (dir._match(relativeName)) {
        throw new Error(`Not a file or directory: ${name}`)
      }
    })

  // start recursive load
  try {
    await load(dir._absolutePath)
  } catch (error) {
    // create the base directory if it doesn't exist
    if (error.code === 'ENOENT' && error.path === dir._absolutePath) {
      await mkdirp(dir._absolutePath)
      await load(dir._absolutePath)
    } else throw error
  }

  // save the new caches and note that the directory has been primed
  /* eslint-disable no-param-reassign */
  dir._files = Immutable.Map(files)
  dir._mtimes = Immutable.Map(mtimes)
  dir._primed = true
  /* eslint-enable no-param-reassign */
}

let queueableMethods // eslint-disable-line prefer-const

/**
 * A `Directory` instance represents a real directory on disk and acts as an in-memory cache of its
 * entire contents.
 *
 * @public
 */

export default class Directory extends EventEmitter {
  /**
   * Reads the contents of the directory, recursively, but cached.
   *
   * @public
   */

  read: (incomingFiles?: Filemap) => Promise<Filemap>

  /**
   * Writes the given files to the directory.
   *
   * @public
   */

  write: FilemapLike => Promise<Filemap>

  watch: (
    subscriber: (Filemap) => any,
    options?: { [string]: any },
  ) => Promise<void>

  close: () => Promise<void>

  _absolutePath: string
  _match: Matcher
  _limit: number
  _log: boolean
  _logWatchErrors: boolean
  _emitWatchErrors: boolean
  _logPrelude: string
  _watcher: Object | null // sane watcher
  _primed: boolean
  _files: Filemap
  _mtimes: Immutable.Map<string, number>
  _queuedOperations: Promise<any>

  constructor(name: string, _options?: { [string]: any }) {
    super()

    const options = { ...defaults, ..._options }

    const dir = this

    // private settings
    dir._absolutePath = path.resolve(name)
    dir._match = createMatcher(options.match)
    dir._limit = parseFilesize(options.limit)
    dir._log = Boolean(options.log)
    dir._logWatchErrors = Boolean(options.logWatchErrors)
    dir._emitWatchErrors = Boolean(options.emitWatchErrors)
    dir._logPrelude =
      grey(path.relative(process.cwd(), dir._absolutePath)) + path.sep

    if (options.force !== true && !subdir(process.cwd(), dir._absolutePath)) {
      throw new Error("wire Directory: Cannot work outside CWD unless you enable 'force'")
    }

    // temporal state
    dir._watcher = null // sane watcher, if active
    dir._primed = false // whether there's anything in the cache

    // intialise caches
    dir._files = Immutable.Map() // [fileName: content]
    dir._mtimes = Immutable.Map() // [fileName: mtime]

    // add all the faux-decorated 'queueable' methods
    for (const methodName of Object.keys(queueableMethods)) {
      const method = queueableMethods[methodName]

      // NB. can't use singleFile here as they all have to share the same queue

      Object.defineProperty(dir, methodName, {
        value: (...methodArgs) => {
          dir._queuedOperations = Promise.resolve(dir._queuedOperations).then(() => method.apply(dir, methodArgs))

          return dir._queuedOperations
        },
      })
    }
  }

  /**
   * Synchronous method to retrieve the files cache as it stands, without revalidating
   * against the disk. Throws if this directory has never been primed.
   */

  getCache(): Filemap {
    if (!this._primed) {
      throw new Error('wire Directory: This instance has never been primed.')
    }
    return this._files
  }
}

// these methods could live inside the class block if decorators were a thing...
queueableMethods = {
  async read(incomingFiles) {
    const dir = this // until babel bugs resolved

    // return from cache immediately if we know this dir is being kept up to date
    if (dir._watching) return dir._files

    await reprime(dir)

    // in case this read() is being used as a transform, merge with the incoming files
    if (incomingFiles) return castFilemap(incomingFiles).merge(dir._files)

    // return the map of files
    return dir._files
  },

  /**
   * Writes a filemap to disk.
   */

  async write(incomingFiles: Filemap): Promise<Filemap> {
    const dir = this

    if (dir._watching) {
      throw new Error('wire: Refusing to write to watched directory')
    }

    // [re]prime this directory, unless it's being kept up to date automatically
    if (!dir._watching) await reprime(dir)

    // see what changes are needed
    const patch = diff(dir._files, incomingFiles)
    const patchKeys = patch.keys()

    // start some mutatable objects based on our existing caches (eventually to replace them)
    const newFiles = dir._files.toObject()
    const newMtimes = dir._mtimes.toObject()

    // note deleted paths (so we can prune empty dirs after deleting the files)
    const deletions = new Set()

    // go through all patch paths in parallel
    await Bluebird.map(patchKeys, async (name) => {
      const content = patch.get(name)

      if (content === null) {
        // the patch says we should delete this file.
        deletions.add(name)
        delete newFiles[name]

        await unlink(path.join(dir._absolutePath, name))
        if (dir._log) console.log(` → delete ${dir._logPrelude}${name}`)
      } else {
        // the patch says this file has changed.
        // write the file to disk
        await mkdirp(path.dirname(path.join(dir._absolutePath, name)))
        await writeFile(path.join(dir._absolutePath, name), content)
        if (dir._log) console.log(` →  write ${dir._logPrelude}${name}`)

        // then set our new caches
        newMtimes[name] = Date.now() // nb. must record time after writing, not before
        newFiles[name] = content
      }
    })

    // now all files are deleted, prune any empty directories in series
    for (const deletion of deletions) {
      await pruneEmptyAncestors(
        path.resolve(dir._absolutePath, deletion),
        dir._absolutePath,
      )
    }

    // update our files cache
    const files = Immutable.Map(newFiles)
    const mtimes = Immutable.Map(newMtimes)

    dir._files = files
    dir._mtimes = mtimes

    return files
  },

  /**
   * Starts watching the directory and calls your subscriber whenever things change.
   */

  async watch(
    subscriber: Filemap => any,
    options?: { [string]: any },
  ): Promise<void> {
    const dir = this

    if (dir._watcher) throw new Error('Already watching')

    await reprime(dir)

    dir._subscriber = Promise.resolve()

    const notify = debounce(() => {
      dir._subscriber = dir._subscriber
        .then(() => subscriber(dir._files))
        .catch((error) => {
          if (dir._logWatchErrors) {
            console.error(red('wire Directory: error from watch subscriber'))
            console.error(error)
          }

          if (dir._emitWatchErrors) dir.emit('error', error)
        })

      return dir._subscriber
    }, 10)

    const onWatchEvent = async (name, root, stat) => {
      if (!dir._match(name)) return

      if (!stat) {
        if (dir._log) console.log('delete', dir._logPrelude + name)

        dir._files = dir._files.delete(name)
        dir._mtimes = dir._mtimes.delete(name)
        notify()
      } else if (stat.isFile()) {
        if (dir._log) console.log('edit', dir._logPrelude + name)

        dir._mtimes = dir._mtimes.set(name, stat.mtime.getTime())
        dir._files = dir._files.set(name, await readFile(path.join(root, name)))
        notify()
      }
    }

    const watcher = sane(dir._absolutePath, options)

    watcher.on('add', onWatchEvent)
    watcher.on('change', onWatchEvent)
    watcher.on('delete', onWatchEvent)
    dir._watcher = watcher

    return new Promise((resolve, reject) => {
      watcher.on('error', reject)

      watcher.on('ready', async () => {
        await reprime(dir)
        await notify()
        resolve()
      })
    })
  },

  async close() {
    const dir = this

    if (!dir._watcher) {
      throw new Error('wire: Directory is not being watched; nothing to close')
    }

    return promisify(dir._watcher.close).call(dir._watcher)
  },
}
