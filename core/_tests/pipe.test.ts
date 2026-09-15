import { test, expect } from 'bun:test'
import { pipe } from '../pipe'
import { diff } from '../diff'
import { lazy } from '../lazy'

test('pipe()', async () => {
  // Pipeline
  const transform = pipe(
    // pass-through (no-op)
    (files) => files,

    // add file (async)
    async (files) => ({ ...files, bar: Buffer.from('bar') }),

    // add file (sync)
    (files) => ({ ...files, baz: Buffer.from('baz') }),

    // null (no-op)
    null,

    // uppercase all contents
    lazy((content) => content.toString().toUpperCase())
  )

  const result = await transform({ foo: Buffer.from('foo') })

  expect(
    diff(result, {
      foo: 'FOO',
      bar: 'BAR',
      baz: 'BAZ',
    })
  ).toBeEmptyObject()
})
