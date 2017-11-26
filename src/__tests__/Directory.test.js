// @flow

import Bluebird from 'bluebird'
import mkdirp from 'mkdirp-promise'
import tempy from 'tempy'

import { promisify } from 'util'
import del from 'del'
import fs from 'fs'
import path from 'path'

import type { Filemap } from '../types'
import Directory from '../Directory'
import diff from '../diff'

const writeFile = promisify(fs.writeFile)

const fooFixturePath = path.resolve(__dirname, '__fixtures__', 'foo')

test('watch()', async () => {
  const tmp = tempy.directory()
  const tmpBarPath = path.resolve(tmp)
  await del(tmpBarPath, { force: true })
  await mkdirp(tmpBarPath)

  const foo = new Directory(fooFixturePath)
  const bar = new Directory(tmpBarPath, { force: true })

  const initialFiles = await foo.read()

  await bar.write(initialFiles)

  const subscriber = jest.fn()

  await bar.watch(subscriber)

  await Bluebird.delay(500)

  // expect(subscriber.mock.calls.length).toBe(1); // TODO investigate why this is sometimes 2

  subscriber.mockReset()

  await writeFile(path.join(tmpBarPath, 'will-this-fire.txt'), 'hello')

  await Bluebird.delay(400)

  expect(subscriber.mock.calls.length).toBe(1)

  const result = subscriber.mock.calls[0][0]

  expect(result.size).toBe(3)

  expect(diff(foo.getCache().set('will-this-fire.txt', Buffer.from('hello')), result)
    .size).toBe(0)

  await bar.close()

  await del(tmpBarPath, { force: true })
})

test('reading files from disk', async () => {
  const foo = new Directory(fooFixturePath, { force: true })

  const files = await foo.read()

  expect(files.toJS()).toEqual({
    'file.txt': Buffer.from('hello\n'),
    [path.join('bar', 'another.css')]: Buffer.from('goodbye\n'),
  })
})

test("filtering out files that don't match", async () => {
  const foo = new Directory(fooFixturePath, {
    match: '**/*.css',
    force: true,
  })

  const files = await foo.read()

  expect(files.toJS()).toEqual({
    [path.join('bar', 'another.css')]: Buffer.from('goodbye\n'),
  })
})

test('write() files to disk and read() them back', async () => {
  const tmp = tempy.directory()

  const tmpBarPath = path.resolve(tmp, 'bar')
  await del(tmpBarPath, { force: true })

  const bar = new Directory(tmpBarPath, { force: true })

  const writtenBar: Filemap = await bar.write({
    'some-file.css': 'aside {background: squirple;}',
    [path.join('another', 'file.css')]: 'figure {color: glue}',
  })

  expect(writtenBar.size).toBe(2)
  expect(String(writtenBar.get('some-file.css'))).toBe('aside {background: squirple;}')
  expect(String(writtenBar.get(path.join('another', 'file.css')))).toBe('figure {color: glue}')

  // read back
  const bar2 = new Directory(tmpBarPath, { force: true })

  const readBar = await bar2.read()

  expect(diff(writtenBar, readBar).size).toBe(0)

  await del(tmpBarPath, { force: true })
})
