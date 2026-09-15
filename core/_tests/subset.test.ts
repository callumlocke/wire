import { test, expect } from 'bun:test'
import { castSnapshot } from '../castSnapshot'
import { diff } from '../diff'
import { subset } from '../subset'

test('subset()', async () => {
  const transform = subset('foo/**', (files) =>
    Object.entries(files).reduce(
      (acc, [path, content]) => ({
        ...acc,
        [path]: content.toString().toUpperCase(),
      }),
      {},
    ),
  )

  const output = await transform(
    castSnapshot({
      'foo/yep.txt': 'this one',
      'foo/another.txt': 'and this one',
      'bar/no.txt': 'but not this one',
    }),
  )

  expect(Object.keys(output).length).toBe(3)

  expect(
    Object.keys(
      diff(output, {
        'foo/yep.txt': 'THIS ONE',
        'foo/another.txt': 'AND THIS ONE',
        'bar/no.txt': 'but not this one',
      }),
    ).length,
  ).toBe(0)
})
