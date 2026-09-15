import { castSnapshot } from './castSnapshot'
import type {
  StrictTransform,
  Transformish,
  PermissiveTransform,
  Snapshottish,
} from '../types'

/**
 * Pipe a list of transforms into a single transform that runs as an asynchronous series of steps.
 *
 * Also casts to filemap before and after each step.
 *
 * Tip: one convenient way to use this is passing `() => files` as the first argument (where `files` is an in-scope filemap), so the resulting transform can be called with no arguments.
 *
 * @public
 */

export const pipe = (
  ...fns: Array<StrictTransform | Transformish | null>
): PermissiveTransform => {
  const pipedTransform: PermissiveTransform = async (
    incomingFiles: Snapshottish = {},
  ) => {
    let output = castSnapshot(incomingFiles)

    for (const fn of fns) {
      if (!fn) continue

      const newOutput = await Promise.resolve(fn(output))
      output = castSnapshot(newOutput)
    }

    return castSnapshot(output)
  }

  return pipedTransform
}
