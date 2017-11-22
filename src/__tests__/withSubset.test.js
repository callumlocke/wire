import { diff, withSubset } from '..'

test('withSubset()', async () => {
  const transform = withSubset('foo/**', files =>
    files.map(content => content.toString().toUpperCase()))

  const output = await transform({
    'foo/yep.txt': 'this one',
    'foo/another.txt': 'and this one',
    'bar/no.txt': 'but not this one',
  })

  expect(output.size).toBe(3)

  expect(diff(output, {
    'foo/yep.txt': 'THIS ONE',
    'foo/another.txt': 'AND THIS ONE',
    'bar/no.txt': 'but not this one',
  }).size).toBe(0)
})
