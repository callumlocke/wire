import type { Filemap, Transform } from '../types'
import { castFilemap } from './castFilemap'

/**
 * Pipe a list of transforms into a single transform that runs as an asynchronous series of steps.
 *
 * Also casts to filemap before and after each step.
 *
 * Tip: one convenient way to use this is passing `() => files` as the first argument, so the resulting transform can be called with no arguments.
 *
 * @public
 */

export const pipe = (...fns: Array<Transform | null>): Transform => {
  const pipedTransform: Transform = async (incomingFiles: Filemap = {}) => {
    let output = castFilemap(incomingFiles)

    for (const fn of fns) {
      if (!fn) continue

      const newOutput = await Promise.resolve(fn(output))
      output = castFilemap(newOutput)
    }

    return castFilemap(output)
  }

  return pipedTransform
}
