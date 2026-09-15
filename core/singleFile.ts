/**
 * Wraps an async callback to so it runs in 'single file', i.e. concurrency of 1. Each call is queued by the wrapper until any pending calls are settled.
 *
 * Example:
 *
 * ```
 * const one = singleFile(async () => { await delay(1000); console.log(1) })
 * const two = singleFile(() => { console.log(2) })
 *
 * one() // not awaited
 * two()
 * // (waits one second, then logs 1, then 2)
 * ```
 */

export const singleFile = <
  Args extends unknown[],
  ReturnValue extends unknown,
  Context
>(
  callback: (...args: Args) => ReturnValue | Promise<ReturnValue>,
  context?: Context
) => {
  let queue: Promise<ReturnValue>

  const singleFileWrapper = function (this: unknown, ...args: Args) {
    const call = () => callback.apply(this === undefined ? context : this, args)

    queue = Promise.resolve(queue).then(call, call)

    return queue
  }

  return singleFileWrapper
}
