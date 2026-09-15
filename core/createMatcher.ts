import picomatch, { type PicomatchOptions } from 'picomatch'
import type { Matchable, Matcher } from '../types'

const compileGlobMatcher = (
  glob: string,
  options?: PicomatchOptions,
): Matcher => {
  const re = picomatch.makeRe(glob, options)
  return (name) => re.test(name)
}

const alwaysTrue = () => true
const alwaysFalse = () => false

const memo: WeakSet<Matcher> = new WeakSet()

/**
 * Creates a reusable function for checking if a file path matches your `filter`.
 *
 * `filter` may be:
 * - a glob string like `'**'`
 * - an array of glob strings like `['**', '!*.js']`
 * - a regular expression
 * - any function
 * - a boolean (`true` matches everything, `false` matches nothing)
 *
 * If an array is passed, the globs are processed in order from left to right. To be considered a match, the file path must match at least one of the globs *and* not be 'unmatched' by a subsequent negative glob.
 *
 * @example
 * ['foo/*', 'foo/!*.js'] // matches non-JS children of `foo`.
 */

export const createMatcher = (
  filter: Matchable = '**',
  options?: PicomatchOptions,
): Matcher => {
  // Return from cache if it's already a matcher and no special options are given
  if (!options && memo.has(filter as Matcher)) return filter as Matcher

  let match: Matcher

  switch (filter) {
    case true:
      return alwaysTrue
    case false:
    case '':
      return alwaysFalse

    default: {
      if (typeof filter === 'string') {
        match = compileGlobMatcher(filter, options)
      } else if (Array.isArray(filter)) {
        const l = filter.length
        const matchers: Matcher[] = []
        const results: boolean[] = []

        for (let i = 0; i < l; i += 1) {
          const p = filter[i]

          if (typeof p !== 'string') {
            throw new TypeError(
              'createMatcher: Arrays can only contain strings.',
            )
          }

          if (p[0] === '!') {
            if (i === 0) {
              throw new Error(
                'createMatcher: First glob in an array cannot be negative',
              )
            }

            results[i] = false
            matchers[i] = compileGlobMatcher(p.substring(1), options)
          } else {
            results[i] = true
            matchers[i] = compileGlobMatcher(p, options)
          }
        }

        match = (name) => {
          let matched = false

          for (let i = 0; i < l; i += 1) {
            const current = matchers[i]!
            if (results[i]) {
              if (current(name)) matched = true
            } else if (current(name)) matched = false
          }

          return matched
        }
      } else if (typeof filter === 'function') {
        match = (name) => Boolean(filter(name))
      } else if (filter instanceof RegExp) {
        match = (name) => filter.test(name)
      } else {
        throw new TypeError(
          `createMatcher: Unexpected pattern type: ${typeof filter}`,
        )
      }
    }
  }

  if (!options) memo.add(match)

  return match
}
