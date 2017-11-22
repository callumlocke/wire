// @flow

import prettyHRTime from 'pretty-hrtime'
import Bluebird from 'bluebird'
import { cache, diff, castFilemap } from '..'

/**
 * Helper to sort an array of calls (to a Jest mock function) so they may be compared for equality
 * with another array of calls, when call order doesn't matter.
 */
const sortCalls = (calls: Array<Array<any>>) =>
  [...calls].sort((a, b) => {
    const aIndex = JSON.stringify(a)
    const bIndex = JSON.stringify(b)

    if (aIndex < bIndex) return 1
    if (aIndex > bIndex) return -1
    return 0
  })

test('cache() returns a caching transform', async () => {
  const spy = jest.fn()

  const transform = cache((content, name, include) => {
    spy(name)

    if (name === 'banner.txt') return null

    if (name.endsWith('.js')) {
      const banner = include('banner.txt')
      if (!banner) throw new Error('banner.txt not found')

      return {
        [name]: `/* ${banner.toString()} */\n${content.toString()}`,
        [`${name}.uppercase`]: content.toString().toUpperCase(),
      }
    }

    return content
  })

  let input = castFilemap({
    'foo.bar': 'misc contents',
    'something.js': 'console.log("hello");',
    'banner.txt': 'Copyright Alphabet 1980',
  })

  let output

  // 1. first transform
  output = await transform(input)
  expect(0).toBe(diff(output, {
    'foo.bar': 'misc contents',
    'something.js': '/* Copyright Alphabet 1980 */\nconsole.log("hello");',
    'something.js.uppercase': 'CONSOLE.LOG("HELLO");',
  }).size)
  expect(3).toBe(spy.mock.calls.length)

  // 2. modifying a single file
  spy.mockReset()
  input = input.set('foo.bar', Buffer.from('updated misc contents!'))
  output = await transform(input)

  expect(0).toBe(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Alphabet 1980 */\nconsole.log("hello");',
    'something.js.uppercase': 'CONSOLE.LOG("HELLO");',
  }).size)
  expect(spy.mock.calls).toEqual([['foo.bar']])
  // expect(1).toBe(spy.mock.calls.length);
  // expect(spy.mock.calls[0][0]).toBe('foo.bar');

  // 3. modifiying an importee
  spy.mockReset()
  input = input.set('banner.txt', Buffer.from('Copyright Zebra 2051'))
  output = await transform(input)

  expect(0).toBe(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Zebra 2051 */\nconsole.log("hello");',
    'something.js.uppercase': 'CONSOLE.LOG("HELLO");',
  }).size)

  expect(sortCalls(spy.mock.calls)).toEqual(sortCalls([['banner.txt'], ['something.js']]))
  // expect(2).toBe(spy.mock.calls.length);
  // expect(spy.calledWith('banner.txt')).toBe(true);
  // expect(spy.calledWith('something.js')).toBe(true);

  // 4. modifying the JS contents
  spy.mockReset()
  input = input.set('something.js', Buffer.from('console.log("changed!");'))
  output = await transform(input)

  expect(0).toBe(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Zebra 2051 */\nconsole.log("changed!");',
    'something.js.uppercase': 'CONSOLE.LOG("CHANGED!");',
  }).size)

  // expect(1).toBe(spy.mock.calls.length);
  // expect(spy.calledWith('something.js')).toBe(true);
  expect(spy.mock.calls).toEqual([['something.js']])

  // 5. adding a new file
  spy.mockReset()
  input = input.set('another.js', Buffer.from('anotherScript();'))
  output = await transform(input)

  expect(0).toBe(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Zebra 2051 */\nconsole.log("changed!");',
    'something.js.uppercase': 'CONSOLE.LOG("CHANGED!");',
    'another.js': '/* Copyright Zebra 2051 */\nanotherScript();',
    'another.js.uppercase': 'ANOTHERSCRIPT();',
  }).size)
  // expect(1).toBe(spy.mock.calls.length);
  // expect(spy.calledWith('another.js')).toBe(true);
  expect(spy.mock.calls).toEqual([['another.js']])

  // 6. changing the imported banner and one of the scripts at the same time
  spy.mockReset()
  input = input.merge({
    'banner.txt': Buffer.from('Copyright Whatever 1999'),
    'another.js': Buffer.from('yup()'),
  })
  output = await transform(input)

  expect(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Whatever 1999 */\nconsole.log("changed!");',
    'something.js.uppercase': 'CONSOLE.LOG("CHANGED!");',
    'another.js': '/* Copyright Whatever 1999 */\nyup()',
    'another.js.uppercase': 'YUP()',
  }).size).toBe(0)

  expect(sortCalls(spy.mock.calls)).toEqual(sortCalls([['banner.txt'], ['something.js'], ['another.js']]))

  // 7. deleting a file
  spy.mockReset()
  input = input.remove('another.js')
  output = await transform(input)

  expect(0).toBe(diff(output, {
    'foo.bar': 'updated misc contents!',
    'something.js': '/* Copyright Whatever 1999 */\nconsole.log("changed!");',
    'something.js.uppercase': 'CONSOLE.LOG("CHANGED!");',
  }).size)
  expect(0).toBe(spy.mock.calls.length)

  // 8. deleting everything
  spy.mockReset()
  input = input.clear()
  output = await transform(input)

  expect(0).toBe(output.size)
  expect(0).toBe(spy.mock.calls.length)
})

test('cache() stress test', async () => {
  // this is just for informal observations.

  const transform = cache((content, name, include) => {
    if (name === 'banner.txt') return null

    if (name.endsWith('.js')) {
      const banner = include('banner.txt')
      if (!banner) throw new Error('banner.txt not found')

      return {
        [name]: `/* ${banner.toString()} */\n${content.toString()}`,
        [`${name}.uppercase`]: content.toString().toUpperCase(),
      }
    }

    return content
  })

  let input = castFilemap({})

  const buf1 = Buffer.alloc(1024, 1)
  const buf2 = Buffer.alloc(80, 2)
  const buf3 = Buffer.from('asdfasdfasdf')
  const buf4 = Buffer.from('fdsafds')
  const buf5 = Buffer.from('aiousdhfioasdf')

  const start = process.hrtime()

  await Bluebird.map(new Array(100), (x, i) => {
    const occasional1 = i % 5 === 0
    const occasional2 = i % 3 === 0
    const occasional3 = i % 11 === 0

    input = input.merge({
      'banner.txt': buf5,
      [`foo${i}.bar`]: buf1,
      [`something${occasional3 ? 'x' : ''}.js`]: occasional1 ? buf3 : buf4,
    })

    if (occasional1) input = input.set('another.js', buf5)

    if (occasional2) {
      input = input.merge({
        'another.bar': buf2,
        'whatever.random': buf1,
      })
    }

    if (occasional3) input = input.set('yetanother.js', buf4)

    return transform(input)
  })

  const duration = process.hrtime(start)

  console.log('\nSTRESS TEST DURATION:', prettyHRTime(duration))
})
