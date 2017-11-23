// @flow

/**
 * Wraps an async function in such a way that its invocations are guaranteed to be
 * ‘[single file](https://en.wiktionary.org/wiki/single_file)’ (one by one).
 *
 * That is, if you make multiple, concurrent calls to the resulting function, they are automatically
 * queued up and passed through your inner function **one at a time** – each new invocation may only
 * begin once the previous async invocation has settled (i.e. once the promise returned by the
 * previous invocation has been fulfilled or rejected).
 *
 * This is used internally by Wire's `tmp` function. It's exported in case it's useful elsewhere.
 *
 * NB. this may be used to wrap a synchronous function too, but there is probably no point because
 * non-recursive synchronous invocations can never overlap in single-threaded JavaScript anyway.
 */

export default function singleFile<Args: Array<any>, ReturnValue: any>(
  fn: (...args: Args) => ReturnValue | Promise<ReturnValue>,
  context: any,
): (...args: Args) => Promise<ReturnValue> {
  let queue = Promise.resolve()

  return function singleFileWrapper(...args) {
    const call = () => fn.apply(this === undefined ? context : this, args)

    queue = queue.then(call, call)

    return queue
  }
}

// NOTE using non-arrow function above because of an incompatility with eslint's arrow-parens rule
// when using flow.
