// @flow

import { Map as ImmutableMap } from 'immutable'

/**
 * An Immutable Map of strings and buffers, usually representing a directory of
 * fileson disk.
 */

export type Filemap = ImmutableMap<string, Buffer>

/**
 * Any object that can be cast into a proper Filemap.
 */
export type FilemapLike =
  | ImmutableMap<string, Buffer | string>
  | { [key: string]: Buffer | string }

/**
 * A function that transforms a filemap.
 */
export type SyncTransform = (inputFilemap: Filemap) => Filemap

export type AsyncTransform = (inputFilemap: Filemap) => Promise<Filemap>

export type Transform = SyncTransform | AsyncTransform

/**
 * Like a transform, but allowed to return any filemap-castable object.
 */
export type LooseTransform = (
  inputFilemap: Filemap,
) => FilemapLike | Promise<FilemapLike>

/**
 * Like a transform, but accepts any filemap-castable input.
 */
export type PermissiveTransform = (
  inputFilemap: FilemapLike,
) => Filemap | Promise<Filemap>

/**
 * The return type of diff(). Like a Filemap, but may also contain `null`
 * values, which are instructions to delete.
 */
// $FlowFixMe
export type FilemapPatch = ImmutableMap<string, Buffer | null>

/**
 * Any compatible input for createMatcher.
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
 */
export type Matcher = (name: string) => boolean

/**
 * Standard base options for plugins.
 */
export type GeneralPluginOptions = {
  root?: string,
  match?: Matchable,
}

/**
 * A function that configures and returns a transform.
 */
export type AsyncTransformFactory = (...any) => AsyncTransform

/**
 * A function passed to a granular build function as part of a caching
 * transform.
 */
export type IncludeFunction = string => Buffer | null

/**
 * A callback used to determine what to output in respect of a single input
 * file, as part of a caching transform.
 */
export type GranularBuildFunction = (
  content: Buffer,
  name: string,
  include: IncludeFunction,
) => Buffer | { [name: string]: Buffer | string } | null

export type PluginFunction = (
  name: 'babel' | 'tmp' | 'run',
  ...args: any
) => AsyncTransform
