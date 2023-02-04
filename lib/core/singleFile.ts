/**
 * Wraps an async callback to ensure that only one invocation can occur at a time. If multiple concurrent invocations are attempted, they are automatically queued and executed in order. It doesn't matter if an invocation is fulfilled or rejected; subsequent queued invocations still run.
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
