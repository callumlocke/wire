import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Snapshot } from '../../types'
import { castSnapshot } from '../castSnapshot'
import { Directory } from '../Directory'
import { tmp } from '../tmp'

describe('tmp()', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'wire-tmp-test-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  test('primes the input, clears stale output and reads files written by the callback', async () => {
    const inputPath = path.join(root, 'input')
    const outputPath = path.join(root, 'output')
    await fs.mkdir(inputPath)
    await fs.writeFile(path.join(inputPath, 'stale.txt'), 'stale input')
    await fs.mkdir(path.join(outputPath, 'old'), { recursive: true })
    await fs.writeFile(
      path.join(outputPath, 'old', 'stale.txt'),
      'stale output',
    )
    const files = castSnapshot({
      'src/main.txt': 'source',
      'other.txt': 'other',
    })
    let calls = 0
    const transform = tmp(async (input, output, names) => {
      calls++
      expect(input).toBeInstanceOf(Directory)
      expect(output).toBeInstanceOf(Directory)
      expect(input.path).toBe(inputPath)
      expect(output.path).toBe(outputPath)
      expect(input.getCache()).toEqual(files)
      expect(await input.read()).toEqual(files)
      expect(names).toEqual(new Set(['src/main.txt', 'other.txt']))
      expect(await fs.readdir(output.path)).toEqual([])

      const content = await fs.readFile(
        path.join(input.path, 'src/main.txt'),
        'utf8',
      )
      await fs.mkdir(path.join(output.path, 'dist'))
      await fs.writeFile(
        path.join(output.path, 'dist', 'main.txt'),
        content.toUpperCase(),
      )
    }, root)

    expect(await transform(files)).toEqual({
      'dist/main.txt': Buffer.from('SOURCE'),
    })
    expect(calls).toBe(1)
  })

  test('updates input between calls while preserving previous output files', async () => {
    const seen: Array<{ files: Snapshot; names: Set<string> }> = []
    const transform = tmp(async (input, output, names) => {
      seen.push({ files: await input.read(), names })
      if (seen.length === 1) {
        await fs.writeFile(path.join(output.path, 'retained.txt'), 'retained')
      }
      await fs.writeFile(
        path.join(output.path, 'latest.txt'),
        await fs.readFile(path.join(input.path, 'source.txt')),
      )
    }, root)
    const first = castSnapshot({
      'source.txt': 'first',
      'removed.txt': 'remove me',
    })
    const second = castSnapshot({ 'source.txt': 'second', 'added.txt': 'new' })

    expect(await transform(first)).toEqual({
      'retained.txt': Buffer.from('retained'),
      'latest.txt': Buffer.from('first'),
    })
    expect(await transform(second)).toEqual({
      'retained.txt': Buffer.from('retained'),
      'latest.txt': Buffer.from('second'),
    })
    expect(seen).toEqual([
      { files: first, names: new Set(['source.txt', 'removed.txt']) },
      { files: second, names: new Set(['source.txt', 'added.txt']) },
    ])
  })

  test('serializes concurrent calls so their input and output files stay separate', async () => {
    const firstStarted = Promise.withResolvers<void>()
    const firstCanFinish = Promise.withResolvers<void>()
    const contents: string[] = []
    const transform = tmp(async (input, output) => {
      contents.push(
        await fs.readFile(path.join(input.path, 'source.txt'), 'utf8'),
      )
      if (contents.length === 1) {
        firstStarted.resolve()
        await firstCanFinish.promise
      }
      await fs.copyFile(
        path.join(input.path, 'source.txt'),
        path.join(output.path, 'result.txt'),
      )
    }, root)
    const first = transform(castSnapshot({ 'source.txt': 'first' }))
    const second = transform(castSnapshot({ 'source.txt': 'second' }))

    try {
      await firstStarted.promise
      expect(contents).toEqual(['first'])
      expect(
        await fs.readFile(path.join(root, 'input', 'source.txt'), 'utf8'),
      ).toBe('first')
    } finally {
      firstCanFinish.resolve()
      await Promise.all([first, second])
    }

    expect(await first).toEqual({ 'result.txt': Buffer.from('first') })
    expect(await second).toEqual({ 'result.txt': Buffer.from('second') })
    expect(contents).toEqual(['first', 'second'])
  })

  test('supports empty input and a synchronous callback that produces no files', async () => {
    let calls = 0
    const transform = tmp((input, output, names) => {
      calls++
      expect(input.getCache()).toEqual({})
      expect(names).toEqual(new Set())
    }, root)

    expect(await transform({})).toEqual({})
    expect(calls).toBe(1)
  })

  test.each([true, false])(
    'propagates callback failures (async=%s)',
    async (isAsync) => {
      const error = new Error('build failed')
      const transform = tmp(() => {
        if (isAsync) return Promise.reject(error)
        throw error
      }, root)

      await expect(transform({})).rejects.toBe(error)
    },
  )
})
