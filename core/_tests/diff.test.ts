import { test } from 'bun:test'
import { diff } from '../diff'
import assert from 'assert'

test('diff', () => {
  const decoder = new TextDecoder()

  const inputFiles = {
    a: '1',
    b: '2',
    c: '3',
  }

  const outputFiles = {
    a: '1', // unchanged
    b: 'TWO', // modified
    // c - deleted
    d: '4', // added
  }

  const patch = diff(inputFiles, outputFiles)

  assert(!('a' in patch), 'Unchanged files should not be included in patch')

  assert(
    patch.b && decoder.decode(patch.b) === 'TWO',
    'Modified files should be included'
  )

  assert(patch.c === null, 'Deletions should be represented as explicit nulls')

  assert(
    patch.d && decoder.decode(patch.d) === '4',
    'New files should be included'
  )
})
