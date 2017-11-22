// @flow

import * as Immutable from 'immutable'
import { castFilemap } from '../src'

test('castFilemap()', () => {
  const files = castFilemap({
    '1.txt': 'One',
    './2.txt': 'Two',
    'foo/../3.txt': Buffer.from('Three'),
  })

  expect(Immutable.Map.isMap(files)).toBe(true)

  expect(files.size).toBe(3)

  expect(Buffer.isBuffer(files.get('1.txt'))).toBe(true)
  expect(Buffer.isBuffer(files.get('2.txt'))).toBe(true)
  expect(Buffer.isBuffer(files.get('3.txt'))).toBe(true)

  expect(String(files.get('1.txt'))).toBe('One')
  expect(String(files.get('2.txt'))).toBe('Two')
  expect(String(files.get('3.txt'))).toBe('Three')
})
