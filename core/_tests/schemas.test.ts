import { expect, expectTypeOf, test } from 'bun:test'
import {
  filemapSchema,
  filemappishSchema,
  matchableSchema,
  transformSchema,
} from '../../schemas'
import type {
  Matchable,
  Snapshot,
  Snapshottish,
  StrictTransform,
} from '../../types'
import { createMatcher } from '../createMatcher'

test('snapshot types retain their values and string keys', () => {
  expectTypeOf<Snapshot>().toEqualTypeOf<Record<string, Buffer>>()
  expectTypeOf<Snapshottish>().toEqualTypeOf<
    Record<string, Buffer | string | null | undefined>
  >()
  expectTypeOf<
    Parameters<Extract<Matchable, (...args: never[]) => unknown>>[0]
  >().toEqualTypeOf<string>()
})

test('filemaps accept buffers and reject other file contents', () => {
  const files = { 'index.txt': Buffer.from('hello') }
  expect(filemapSchema.parse(files)).toEqual(files)
  expect(filemapSchema.parse({})).toEqual({})

  for (const value of ['hello', null, undefined, 42, new Uint8Array([1])]) {
    expect(filemapSchema.safeParse({ 'index.txt': value }).success).toBe(false)
  }
})

test('filemappish values include strings, null and undefined', () => {
  const files = {
    'buffer.txt': Buffer.from('hello'),
    'string.txt': 'hello',
    'deleted.txt': null,
    'absent.txt': undefined,
  }
  expect(filemappishSchema.parse(files)).toEqual(files)
  expect(filemappishSchema.safeParse({ 'invalid.txt': 42 }).success).toBe(false)
})

test('matchables retain patterns and callbacks with truthy or falsy results', () => {
  for (const pattern of [
    '*.txt',
    ['*.txt', '!ignored.txt'],
    /\.txt$/,
    true,
    false,
    null,
  ]) {
    expect(matchableSchema.safeParse(pattern).success).toBe(true)
  }
  for (const pattern of [42, {}, ['*.txt', 42]]) {
    expect(matchableSchema.safeParse(pattern).success).toBe(false)
  }

  const match = createMatcher(
    matchableSchema.parse((name: string) =>
      name === 'index.txt' ? 1 : undefined,
    ),
  )
  expect(match('index.txt')).toBe(true)
  expect(match('other.txt')).toBe(false)
})

test('synchronous transforms validate input and output filemaps', () => {
  const transform = transformSchema.implement((files) => files)
  expectTypeOf(transform).toExtend<StrictTransform>()
  const files = { 'index.txt': Buffer.from('hello') }
  expect(transform(files)).toEqual(files)

  // Exercise runtime validation of callers outside TypeScript.
  // @ts-expect-error Filemap contents must be buffers.
  expect(() => transform({ 'index.txt': 'hello' })).toThrow()
  const invalid = transformSchema.parse(() => ({ 'index.txt': 'hello' }))
  expect(() => invalid(files)).toThrow()
  expect(transformSchema.safeParse({}).success).toBe(false)
})

test('asynchronous transforms validate resolved output filemaps', async () => {
  const transform = transformSchema.implementAsync(async (files) => files)
  expectTypeOf(transform).toExtend<StrictTransform>()
  const files = { 'index.txt': Buffer.from('hello') }
  expect(await transform(files)).toEqual(files)

  // @ts-expect-error Filemap contents must be buffers.
  await expect(transform({ 'index.txt': 'hello' })).rejects.toThrow()
  // @ts-expect-error Resolved transform contents must be buffers.
  const invalid = transformSchema.implementAsync(async () => ({
    'index.txt': 'hello',
  }))
  await expect(invalid(files)).rejects.toThrow()
})
