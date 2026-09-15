import { expect, test } from 'bun:test'
import { createMatcher } from '../createMatcher'

test('default options', () => {
  const match = createMatcher('foo/**/*.css')

  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
  expect(match('a.css')).toBe(false)
  expect(match('a/b/c/d.css')).toBe(false)
  expect(match('a/b/c/d.html')).toBe(false)

  expect(match('foo/a/b/c/.d.css')).toBe(false)
})

test('dot:true option enables matching dotfiles', () => {
  const match = createMatcher('foo/**/*.css', { dot: true })

  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
  expect(match('a.css')).toBe(false)
  expect(match('a/b/c/d.css')).toBe(false)
  expect(match('a/b/c/d.html')).toBe(false)

  expect(match('foo/a/b/c/.d.css')).toBe(true)
})

test('defaults can match dotfiles if pattern has an explicit dot', () => {
  const match = createMatcher(['foo/**/.*'])
  expect(match('foo/a.css')).toBe(false)
  expect(match('foo/.gitignore')).toBe(true)
})

test('array of globs', () => {
  const match = createMatcher([
    'foo/**/*.css',
    'other/*.txt',
    '!**/*bar.*',
    '**/*.ok',
  ])

  expect(match('foo/a.css')).toBe(true)
  expect(match('other/x.txt')).toBe(true)
  expect(match('foo/a/b/c/x.css')).toBe(true)

  expect(match('foo/a/b/c/x-bar.css')).toBe(false) // blocked by negative glob `!**/*bar.*`
  expect(match('foo/a/b/c/x-bar.css.ok')).toBe(true) // blocked by negative glob but then matched by positive glob after it
})

test('weird but valid globs', () => {
  const match = createMatcher('*/*/**')

  expect(match('x.txt')).toBe(false)
  expect(match('a/x.txt')).toBe(false)
  expect(match('a/b/x.txt')).toBe(true)
  expect(match('a/b/c/x.txt')).toBe(true)
  expect(match('a/b/c/d/x.txt')).toBe(true)

  const match2 = createMatcher('*/b/*/**')

  expect(match2('x.txt')).toBe(false)
  expect(match2('a/x.txt')).toBe(false)
  expect(match2('a/b/x.txt')).toBe(false)
  expect(match2('a/b/c/x.txt')).toBe(true)
  expect(match2('a/b/c/d/x.txt')).toBe(true)
})

test('behaves like "**" if no pattern given', () => {
  const match = createMatcher(undefined)

  expect(match('a.css')).toBe(true)
  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
})

test('function', () => {
  const match = createMatcher((file) => (file === 'foo' ? 1 : undefined))

  expect(match('foo')).toBe(true)
  expect(match('bar')).toBe(false)
})

test('regular expression', () => {
  const match = createMatcher(/\.css$/)

  expect(match('a.css')).toBe(true)
  expect(match('a.html')).toBe(false)
})
