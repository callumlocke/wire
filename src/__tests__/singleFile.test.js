// @flow

import Bluebird from 'bluebird'
import { singleFile } from '..'

describe('singleFile()', () => {
  test('basic functionality', async () => {
    let concurrency = 0
    let highestConcurrency = 0

    const bareFunction = async (foo: number, bar: boolean) => {
      concurrency += 1

      if (concurrency > highestConcurrency) highestConcurrency = concurrency

      await Bluebird.delay(10)

      concurrency -= 1

      if (bar) return foo * 2
      return foo / 2
    }

    // first verify that the the test function works concurrently, as normal
    {
      const calls = Array.from({ length: 10 }).map((x, i) =>
        bareFunction(i, Boolean(i % 2)))

      await Promise.all(calls)

      expect(highestConcurrency).toBe(10)
    }

    // now verify how it works when wrapped as singleFile
    {
      // reset values
      concurrency = 0
      highestConcurrency = 1

      const wrappedFunction = singleFile(bareFunction)

      const calls = Array.from({ length: 10 }).map((x, i) =>
        wrappedFunction(i, Boolean(i % 2)))

      await Promise.all(calls)

      expect(highestConcurrency).toBe(1)
    }
  })

  test('passing context as 2nd arg', async () => {
    async function bareFunction() {
      return this + 5
    }

    const wrappedFunction = singleFile(bareFunction, 3)

    const result = await wrappedFunction()

    expect(result).toBe(8)
  })

  test('setting context with .call() on the wrapped function', async () => {
    async function bareFunction() {
      return this + 5
    }

    const wrappedFunction = singleFile(bareFunction)

    const result = await wrappedFunction.call(3)

    expect(result).toBe(8)
  })

  test('setting context with .bind() on the bare function', async () => {
    async function bareFunction() {
      return this + 5
    }

    const wrappedFunction = singleFile(bareFunction.bind(3))

    const result = await wrappedFunction()

    expect(result).toBe(8)
  })

  test('setting context with .bind() on the wrapped function', async () => {
    async function bareFunction() {
      return this + 5
    }

    const wrappedFunction = singleFile(bareFunction).bind(3)

    const result = await wrappedFunction()

    expect(result).toBe(8)
  })
})
