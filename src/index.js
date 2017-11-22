// @flow

import cache from './cache'
import castFilemap from './castFilemap'
import compose from './compose'
import createMatcher from './createMatcher'
import diff from './diff'
import Directory from './Directory'
import singleFile from './singleFile'
import withSubset from './withSubset'

import type {
  Filemap,
  FilemapLike,
  SyncTransform,
  AsyncTransform,
  Transform,
  LooseTransform,
  PermissiveTransform,
  FilemapPatch,
  Matchable,
  Matcher,
  GeneralPluginOptions,
  AsyncTransformFactory,
  IncludeFunction,
  GranularBuildFunction,
  PluginFunction,
} from './types'

export { cache, castFilemap, compose, createMatcher, diff, Directory, singleFile, withSubset }

export type {
  Filemap,
  FilemapLike,
  SyncTransform,
  AsyncTransform,
  Transform,
  LooseTransform,
  PermissiveTransform,
  FilemapPatch,
  Matchable,
  Matcher,
  GeneralPluginOptions,
  AsyncTransformFactory,
  IncludeFunction,
  GranularBuildFunction,
  PluginFunction,
}
