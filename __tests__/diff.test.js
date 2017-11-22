// @flow

import { diff } from '../src'

test('diff() works', () => {
  const input = {
    foo: 'foo!',
    bar: 'bar!',
  }

  const output = {
    foo: 'foo!',
    baz: 'baz!',
  }

  const changes = diff(input, output)
    .map(contents => contents && contents.toString())
    .toJS()

  expect(changes).toEqual({
    baz: 'baz!',
    bar: null,
  })
})
