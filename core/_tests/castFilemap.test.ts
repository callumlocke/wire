import { test, expect, describe } from 'bun:test'

import { castSnapshot } from '../castSnapshot'

describe('castFilemap()', () => {
  test('basic', () => {
    expect(
      castSnapshot({
        '1.txt': 'One',
        './2.txt': 'Two',
        'foo/../3.txt': Buffer.from('Three'),
      })
    ).toMatchObject({
      '1.txt': Buffer.from('One'),
      '2.txt': Buffer.from('Two'),
      '3.txt': Buffer.from('Three'),
    })
  })

  test('throws on absolute paths or paths that go outside the root', () => {
    expect(() => {
      castSnapshot({
        'foo/../../file.txt': 'Outside root',
      })
    }).toThrowError()

    expect(() => {
      castSnapshot({
        '/foo/file.txt': 'Absolute path',
      })
    }).toThrowError()
  })
})
