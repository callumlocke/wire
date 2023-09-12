import micromatch from 'micromatch'
import type { Matchable, Matcher } from '../types'

const compileGlobMatcher = (
  glob: string,
  options?: micromatch.Options // TODO
): Matcher => {
  const re = micromatch.makeRe(glob, options)
  return (name) => re.test(name)
}

const alwaysTrue = () => true
const alwaysFalse = () => false

const memo: WeakSet<Matcher> = new WeakSet()

type CreateMatcherOptions = {
  globOptions?: micromatch.Options
}

/**
 * Creates a function for checking if a filename matches certain criteria.
 *
 * Very permissive in what it accepts, but always returns `(string) => boolean`.
 *
 * `criteria` may be:
 * - a glob string like `'**'`
 * - an array of glob strings like `['**', '!*.js']`
 * - a regular expression
 * - any function (it will be called with the test string and its return value will be taken as boolean)
 * - a boolean (`true` matches everything, `false` matches nothing)
 *
 * If an array is passed, the globs are processed in order from left to right. A negative glob can unmatch something that has thus far been matched. So if you want to match everything except `*.js` files, you would do `['**', '!*.js']`. This implies that the first glob can never be negative, as it would have no effect - if you try to do that, an error will be thrown.
 */
export const createMatcher = (
  criteria: Matchable = '**',
  options?: CreateMatcherOptions
): Matcher => {
  // Return from cache if it's already a matcher and no special options are given
  if (!options && memo.has(criteria as Matcher)) return criteria as Matcher

  let matcher: Matcher

  switch (criteria) {
    case false:
      return alwaysFalse
    case true:
      return alwaysTrue
    case '':
      throw new Error('createMatcher: Pattern cannot be an empty string')

    default: {
      if (typeof criteria === 'string') {
        matcher = compileGlobMatcher(criteria, options?.globOptions)
      } else if (Array.isArray(criteria)) {
        const l = criteria.length
        const matchers: Matcher[] = []
        const results: boolean[] = []

        for (let i = 0; i < l; i += 1) {
          const p = criteria[i]

          if (typeof p !== 'string') {
            throw new TypeError(
              'createMatcher: When pattern is an array, it must only contain strings.'
            )
          }

          if (p.charAt(0) === '!') {
            if (i === 0) {
              throw new Error(
                'createMatcher: First glob in an array cannot be negative'
              )
            }

            results[i] = false
            matchers[i] = compileGlobMatcher(
              p.substring(1),
              options?.globOptions
            )
          } else {
            results[i] = true
            matchers[i] = compileGlobMatcher(p, options?.globOptions)
          }
        }

        matcher = (name) => {
          let matched = false

          for (let i = 0; i < l; i += 1) {
            const currentMatcher = matchers[i]
            if (results[i]) {
              if (currentMatcher(name)) matched = true
            } else if (currentMatcher(name)) matched = false
          }

          return matched
        }
      } else if (typeof criteria === 'function') {
        matcher = (name) => Boolean(criteria(name))
      } else if (criteria instanceof RegExp) {
        matcher = (name) => criteria.test(name)
      } else {
        throw new TypeError(
          `createMatcher: Unexpected pattern type: ${typeof criteria}`
        )
      }
    }
  }

  if (!options) memo.add(matcher)

  return matcher
}
