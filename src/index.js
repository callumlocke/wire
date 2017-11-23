// @flow

import * as Immutable from 'immutable'

import cache from './cache'
import castFilemap from './castFilemap'
import compose from './compose'
import createMatcher from './createMatcher'
import diff from './diff'
import Directory from './Directory'
import singleFile from './singleFile'
import withSubset from './withSubset'

export {
  cache,
  castFilemap,
  compose,
  createMatcher,
  diff,
  Directory,
  singleFile,
  withSubset,
}

/**
 * An Immutable Map of strings and buffers, usually representing a directory of
 * fileson disk.
 *
 * @public
 */

export type Filemap = Immutable.Map<string, Buffer>

/**
 * Any object that can be cast into a proper Filemap.
 *
 * @public
 */
export type FilemapLike =
  | Immutable.Map<string, Buffer | string>
  | { [key: string]: Buffer | string }

/**
 * A function that transforms a filemap.
 *
 * @public
 */
export type SyncTransform = (inputFilemap: Filemap) => Filemap

/** @public */
export type AsyncTransform = (inputFilemap: Filemap) => Promise<Filemap>

/** @public */
export type Transform = SyncTransform | AsyncTransform

/**
 * Like a transform, but allowed to return any filemap-castable object.
 *
 * @public
 */
export type LooseTransform = (
  inputFilemap: Filemap,
) => FilemapLike | Promise<FilemapLike>

/**
 * Like a transform, but accepts any filemap-castable input.
 *
 * @public
 */
export type PermissiveTransform = (
  inputFilemap: FilemapLike,
) => Filemap | Promise<Filemap>

/**
 * The return type of diff(). Like a Filemap, but may also contain `null`
 * values, which are instructions to delete.
 *
 * @public
 */
// $FlowFixMe
export type FilemapPatch = Immutable.Map<string, Buffer | null>

/**
 * Any compatible input for createMatcher.
 *
 * @public
 */
export type Matchable =
  | RegExp
  | Array<string>
  | string
  | void
  | null
  | ((name: string) => any)

/**
 * A function that returns `true` or `false` for a filename.
 *
 * @public
 */
export type Matcher = (name: string) => boolean

/**
 * Standard base options for plugins.
 *
 * @public
 */

export type GeneralPluginOptions = {
  root?: string,
  match?: Matchable,
}

/**
 * A function that configures and returns a transform.
 *
 * @public
 */

export type AsyncTransformFactory = (...any) => AsyncTransform

/**
 * A function passed to a granular build function as part of a caching
 * transform.
 *
 * @public
 */

export type IncludeFunction = string => Buffer | null

/**
 * A callback used to determine what to output in respect of a single input
 * file, as part of a caching transform.
 *
 * @public
 */

export type GranularBuildFunction = (
  content: Buffer,
  name: string,
  include: IncludeFunction,
) => Buffer | { [name: string]: Buffer | string } | null
