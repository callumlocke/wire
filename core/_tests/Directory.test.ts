import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Snapshot } from '../../types'
import { castSnapshot } from '../castSnapshot'
import { Directory } from '../Directory'

describe('Directory', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'wire-directory-test-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  test('resolves paths and requires force to work outside the current directory', () => {
    const localPath = path.join('build', 'output')
    expect(new Directory(localPath).path).toBe(path.resolve(localPath))
    expect(() => new Directory(root)).toThrow('Cannot work outside CWD')
    expect(new Directory(root, { force: true }).path).toBe(root)
  })

  test('rejects cache reads until the directory has been primed', () => {
    const directory = new Directory(root, { force: true })

    expect(() => directory.getCache()).toThrow('has never been primed')
  })

  test('creates a missing directory on the first read', async () => {
    const directory = new Directory(path.join(root, 'new', 'nested'), {
      force: true,
    })

    expect(await directory.read()).toEqual({})
    expect((await fs.stat(directory.path)).isDirectory()).toBe(true)
    expect(directory.getCache()).toEqual({})
  })

  test('reads nested files as buffers and refreshes the cache from disk', async () => {
    await fs.mkdir(path.join(root, 'nested'))
    await fs.writeFile(path.join(root, 'file.txt'), 'first')
    await fs.writeFile(
      path.join(root, 'nested', 'binary.bin'),
      Buffer.from([0, 255, 128]),
    )
    const directory = new Directory(root, { force: true })

    const first = await directory.read()
    expect(first).toEqual({
      'file.txt': Buffer.from('first'),
      'nested/binary.bin': Buffer.from([0, 255, 128]),
    })
    expect(directory.getCache()).toBe(first)

    await fs.writeFile(path.join(root, 'file.txt'), 'updated')
    await fs.rm(path.join(root, 'nested', 'binary.bin'))
    await fs.writeFile(path.join(root, 'added.txt'), 'added')
    expect(directory.getCache()).toBe(first)

    const second = await directory.read()
    expect(second).toEqual({
      'file.txt': Buffer.from('updated'),
      'added.txt': Buffer.from('added'),
    })
    expect(directory.getCache()).toBe(second)
  })

  test('filters reads and cached files by root-relative paths, including nested matches', async () => {
    await fs.mkdir(path.join(root, 'nested'))
    await fs.writeFile(path.join(root, 'main.css'), 'main styles')
    await fs.writeFile(path.join(root, 'nested', 'theme.css'), 'nested styles')
    await fs.writeFile(path.join(root, 'nested', 'script.js'), 'script')
    await fs.writeFile(path.join(root, 'README.md'), 'readme')
    const directory = new Directory(root, {
      force: true,
      match: '**/*.css',
    })

    const files = await directory.read()

    expect(files).toEqual({
      'main.css': Buffer.from('main styles'),
      'nested/theme.css': Buffer.from('nested styles'),
    })
    expect(directory.getCache()).toBe(files)
  })

  test('returns an empty snapshot when match is false', async () => {
    await fs.writeFile(path.join(root, 'file.txt'), 'contents')
    const directory = new Directory(root, { force: true, match: false })

    expect(await directory.read()).toEqual({})
    expect(directory.getCache()).toEqual({})
  })

  test('allows total file contents exactly at the size limit', async () => {
    await fs.writeFile(path.join(root, 'first.txt'), 'abc')
    await fs.writeFile(path.join(root, 'second.txt'), 'de')
    const directory = new Directory(root, { force: true, limit: '5B' })

    expect(await directory.read()).toEqual({
      'first.txt': Buffer.from('abc'),
      'second.txt': Buffer.from('de'),
    })
  })

  test('rejects a file over the size limit measured in bytes, not characters', async () => {
    await fs.writeFile(path.join(root, 'file.txt'), 'é')
    const directory = new Directory(root, { force: true, limit: '1B' })

    await expect(directory.read()).rejects.toThrow(
      'File size limit exceeded options.limit (1B)',
    )
    expect(() => directory.getCache()).toThrow('has never been primed')
  })

  test('enforces the combined size of files across nested directories', async () => {
    await fs.mkdir(path.join(root, 'nested'))
    await fs.writeFile(path.join(root, 'first.txt'), 'abc')
    await fs.writeFile(path.join(root, 'nested', 'second.txt'), 'def')
    const directory = new Directory(root, { force: true, limit: '5B' })

    await expect(directory.read()).rejects.toThrow(
      'File size limit exceeded options.limit (5B)',
    )
  })

  test('counts only matching files toward the size limit', async () => {
    await fs.mkdir(path.join(root, 'nested'))
    await fs.writeFile(path.join(root, 'nested', 'style.css'), 'ab')
    await fs.writeFile(path.join(root, 'ignored.txt'), Buffer.alloc(100))
    const directory = new Directory(root, {
      force: true,
      match: '**/*.css',
      limit: '2B',
    })

    expect(await directory.read()).toEqual({
      'nested/style.css': Buffer.from('ab'),
    })
  })

  test('preserves the previous cache if refreshed files exceed the size limit', async () => {
    await fs.writeFile(path.join(root, 'file.txt'), 'abc')
    const directory = new Directory(root, { force: true, limit: '3B' })
    const previous = await directory.read()
    await fs.writeFile(path.join(root, 'file.txt'), 'abcd')

    await expect(directory.read()).rejects.toThrow('File size limit exceeded')
    expect(directory.getCache()).toBe(previous)
    expect(directory.getCache()).toEqual({ 'file.txt': Buffer.from('abc') })
  })

  test('merges incoming files with disk contents taking precedence', async () => {
    await fs.writeFile(path.join(root, 'shared.txt'), 'disk')
    const directory = new Directory(root, { force: true })
    const incoming = castSnapshot({
      'shared.txt': 'incoming',
      'incoming.txt': 'kept',
    })

    expect(await directory.read(incoming)).toEqual({
      'shared.txt': Buffer.from('disk'),
      'incoming.txt': Buffer.from('kept'),
    })
    expect(directory.getCache()).toEqual({ 'shared.txt': Buffer.from('disk') })
    expect(incoming['shared.txt']).toEqual(Buffer.from('incoming'))
  })

  test('writes strings and buffers to nested paths and returns the updated cache', async () => {
    const directory = new Directory(path.join(root, 'output'), { force: true })
    const binary = Buffer.from([0, 255, 128])
    const written = await directory.write({
      './nested/file.txt': 'contents',
      'binary.bin': binary,
      'omitted.txt': null,
    })

    expect(written).toEqual({
      'nested/file.txt': Buffer.from('contents'),
      'binary.bin': binary,
    })
    expect(directory.getCache()).toBe(written)
    expect(
      await fs.readFile(
        path.join(directory.path, 'nested', 'file.txt'),
        'utf8',
      ),
    ).toBe('contents')
    expect(await fs.readFile(path.join(directory.path, 'binary.bin'))).toEqual(
      binary,
    )
    expect(await new Directory(directory.path, { force: true }).read()).toEqual(
      written,
    )
  })

  test('replaces disk contents by adding, modifying and deleting files', async () => {
    const directory = new Directory(root, { force: true })
    await directory.write({
      'unchanged.txt': 'same',
      'changed.txt': 'before',
      'removed.txt': 'remove me',
    })

    const written = await directory.write({
      'unchanged.txt': 'same',
      'changed.txt': 'after',
      'added.txt': 'new',
    })

    expect(written).toEqual({
      'unchanged.txt': Buffer.from('same'),
      'changed.txt': Buffer.from('after'),
      'added.txt': Buffer.from('new'),
    })
    expect(directory.getCache()).toBe(written)
    expect(await new Directory(root, { force: true }).read()).toEqual(written)
    expect((await fs.readdir(root)).sort()).toEqual([
      'added.txt',
      'changed.txt',
      'unchanged.txt',
    ])
  })

  test('queues writes and reads in call order', async () => {
    const directory = new Directory(root, { force: true })
    const first = directory.write({ 'file.txt': 'first' })
    const readFirst = directory.read()
    const second = directory.write({ 'file.txt': 'second' })
    const readSecond = directory.read()

    expect(await Promise.all([first, readFirst, second, readSecond])).toEqual([
      { 'file.txt': Buffer.from('first') },
      { 'file.txt': Buffer.from('first') },
      { 'file.txt': Buffer.from('second') },
      { 'file.txt': Buffer.from('second') },
    ])
  })

  test('logs writes but skips unchanged files', async () => {
    const log = mock((message: string) => {})
    const directory = new Directory(root, { force: true, log })

    await directory.write({ 'file.txt': 'contents' })
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]![0]).toContain('file.txt')

    log.mockClear()
    await directory.write({ 'file.txt': 'contents' })
    expect(log).not.toHaveBeenCalled()
  })

  test('delivers the initial watched snapshot and rejects writes while watching', async () => {
    await fs.writeFile(path.join(root, 'file.txt'), 'contents')
    const directory = new Directory(root, { force: true })
    const notified = Promise.withResolvers<Snapshot>()

    try {
      await directory.watch((files) => notified.resolve(files))
      expect(await notified.promise).toEqual({
        'file.txt': Buffer.from('contents'),
      })
      expect(await directory.read()).toBe(directory.getCache())
      await expect(directory.write({})).rejects.toThrow(
        'Refusing to write to watched directory',
      )
    } finally {
      await directory.close()
    }
  })

  test('rejects closing a directory that is not being watched', () => {
    const directory = new Directory(root, { force: true })

    expect(() => directory.close()).toThrow('no watcher to close')
  })
})
