import { describe, expect, mock, test } from 'bun:test'
import type { Patch, Snapshot } from '../../types'
import { castSnapshot } from '../castSnapshot'
import { withPatch } from '../withPatch'

describe('withPatch()', () => {
  test('reports all initial files as additions and returns the callback result', async () => {
    const input = castSnapshot({ 'source.txt': 'source' })
    const output = castSnapshot({ 'compiled.txt': 'compiled' })
    const callback = mock((files: Snapshot, patch: Patch) => output)
    const transform = withPatch(callback)

    expect(await transform(input)).toBe(output)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(input, {
      'source.txt': Buffer.from('source'),
    })
    expect(callback.mock.calls[0]![0]).toBe(input)
  })

  test('tracks additions, modifications and deletions against the previous input', async () => {
    const callback = mock((files: Snapshot, patch: Patch) => ({}))
    const transform = withPatch(callback)

    await transform(
      castSnapshot({
        'same.txt': 'same',
        'changed.txt': 'before',
        'gone.txt': 'gone',
      }),
    )
    const next = castSnapshot({
      'same.txt': 'same',
      'changed.txt': 'after',
      'added.txt': 'new',
    })
    await transform(next)

    expect(callback.mock.calls[1]![1]).toEqual({
      'changed.txt': Buffer.from('after'),
      'added.txt': Buffer.from('new'),
      'gone.txt': null,
    })

    // Equal contents in fresh buffers still count as unchanged.
    await transform(
      castSnapshot({
        'same.txt': 'same',
        'changed.txt': 'after',
        'added.txt': 'new',
      }),
    )
    expect(callback.mock.calls[2]![1]).toEqual({})

    await transform({})
    expect(callback.mock.calls[3]![1]).toEqual({
      'same.txt': null,
      'changed.txt': null,
      'added.txt': null,
    })
  })

  test('queues concurrent calls and waits for each callback to finish', async () => {
    const firstStarted = Promise.withResolvers<void>()
    const firstCanFinish = Promise.withResolvers<void>()
    const calls: Array<{ input: Snapshot; patch: Patch }> = []
    const transform = withPatch(async (input, patch) => {
      calls.push({ input, patch })
      if (calls.length === 1) {
        firstStarted.resolve()
        await firstCanFinish.promise
      }
      return input
    })
    const firstInput = castSnapshot({ 'file.txt': 'first' })
    const secondInput = castSnapshot({ 'file.txt': 'second' })

    const first = transform(firstInput)
    const second = transform(secondInput)
    try {
      await firstStarted.promise
      expect(calls).toEqual([{ input: firstInput, patch: firstInput }])
    } finally {
      firstCanFinish.resolve()
      await Promise.all([first, second])
    }

    expect(await first).toBe(firstInput)
    expect(await second).toBe(secondInput)
    expect(calls).toEqual([
      { input: firstInput, patch: firstInput },
      { input: secondInput, patch: { 'file.txt': Buffer.from('second') } },
    ])
  })

  test('keeps patch history separate for each wrapped transform', async () => {
    const callback = mock((files: Snapshot, patch: Patch) => files)
    const first = withPatch(callback)
    const second = withPatch(callback)
    const input = castSnapshot({ 'file.txt': 'contents' })

    await first(input)
    await second(input)
    await first(input)

    expect(callback.mock.calls.map(([, patch]) => patch)).toEqual([
      input,
      input,
      {},
    ])
  })

  test.each([true, false])(
    'propagates callback failures and allows later calls (async=%s)',
    async (isAsync) => {
      const error = new Error('transform failed')
      const transform = withPatch((input) => {
        if ('fail.txt' in input) {
          if (isAsync) return Promise.reject(error)
          throw error
        }
        return input
      })

      await expect(
        transform(castSnapshot({ 'fail.txt': 'fail' })),
      ).rejects.toBe(error)
      const next = castSnapshot({ 'success.txt': 'success' })
      expect(await transform(next)).toBe(next)
    },
  )
})
