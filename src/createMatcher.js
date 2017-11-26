// @flow

import minimatch from 'minimatch'
import type { Matchable, Matcher } from '.'

const defaults = {
  dot: false,
}

const compileGlobMatcher = (glob, options) => {
  // DISABLED pending https://github.com/isaacs/minimatch/issues/29
  // const re = minimatch.makeRe(glob, options);
  // return name => re.test(name);

  const fn = name => minimatch(name, glob, options)
  return fn
}

const memo: WeakSet<Matcher> = new WeakSet()

/**
 * Creates a function that can be used repeatedly to check if a filename matches certain criteria.
 *
 * @public
 */

const createMatcher = (
  pattern: Matchable = '**',
  _options?: Object,
): Matcher => {
  if (!_options && typeof pattern === 'function' && memo.has(pattern)) {
    return pattern
  }

  const options = { ...defaults, ..._options }

  let matcher

  switch (pattern) {
    case false:
      throw new Error('wire createMatcher: pattern cannot be false')

    case '':
      throw new Error('wire createMatcher: pattern cannot be an empty string')

    default: {
      const mmOptions = { dot: options.dot }

      if (typeof pattern === 'string') {
        matcher = compileGlobMatcher(pattern, mmOptions)
      } else if (Array.isArray(pattern)) {
        // return a fast function mimicking multimatch behaviour

        const l = pattern.length
        const matchers = []
        const results = []

        for (let i = 0; i < l; i += 1) {
          const p = pattern[i]

          if (typeof p !== 'string') {
            throw new TypeError('wire: createMatcher: When pattern is an array, it must contain only strings.')
          }

          if (p.charAt(0) === '!') {
            if (i === 0) {
              throw new Error('wire createMatcher: First glob in an array cannot be negative.')
            }

            results[i] = false
            // matchers[i] = micromatch.matcher(p.substring(1), mmOptions);
            matchers[i] = compileGlobMatcher(p.substring(1), mmOptions)
          } else {
            results[i] = true
            // matchers[i] = micromatch.matcher(p, mmOptions);
            matchers[i] = compileGlobMatcher(p, mmOptions)
          }
        }

        matcher = (name) => {
          let matched = false

          for (let i = 0; i < l; i += 1) {
            if (results[i]) {
              if (matchers[i](name)) matched = true
            } else if (matchers[i](name)) matched = false
          }

          return matched
        }
      } else if (typeof pattern === 'function') {
        matcher = name => Boolean(pattern(name))
      } else if (pattern instanceof RegExp) {
        matcher = name => pattern.test(name)
      } else {
        throw new TypeError(`wire createMatcher: Unexpected pattern type: ${typeof pattern}`)
      }
    }
  }

  memo.add(matcher)

  return matcher
}

export default createMatcher
