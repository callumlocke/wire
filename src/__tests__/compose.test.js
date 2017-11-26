// @flow

import compose from '../compose'

test('compose() function', async () => {
  const transform = compose(
    files => files,
    async files => files.set('bar', 'bar'),
    files => files.set('bar', 'bar'),
    null,
    files => files.set('bar', `${String(files.get('bar'))}!`),
  )

  const result = await transform({ foo: 'foo!' })

  expect(result.map(contents => contents.toString()).toJS()).toEqual({
    foo: 'foo!',
    bar: 'bar!',
  })
})
