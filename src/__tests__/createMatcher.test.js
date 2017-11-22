// @flow

import { createMatcher } from '..'

test('createMatcher() works with a glob', () => {
  const match = createMatcher('foo/**/*.css')

  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
  expect(match('a.css')).toBe(false)
  expect(match('a/b/c/d.css')).toBe(false)
  expect(match('a/b/c/d.html')).toBe(false)

  // DISABLED pending https://github.com/jonschlinkert/micromatch/issues/63
  // t.false(match('foo/a/b/c/.d.css'));
})

test('createMatcher() works with an array of globs', () => {
  const match = createMatcher(['foo/**/*.css', 'other/*.txt', '!**/*bar.*'])

  expect(match('foo/a.css')).toBe(true)
  expect(match('other/x.txt')).toBe(true)
  expect(match('foo/a/b/c/x.css')).toBe(true)
  expect(match('foo/a/b/c/x-bar.css')).toBe(false)

  // DISABLED pending https://github.com/jonschlinkert/micromatch/issues/63
  // t.false(match('foo/a/.b.css'));
  // t.false(match('foo/a/.b.css'));
})

test('createMatcher() works with weird case', () => {
  const match = createMatcher('*/*/**')

  expect(match('x.txt')).toBe(false)
  expect(match('a/x.txt')).toBe(false)
  expect(match('a/b/x.txt')).toBe(true)
  expect(match('a/b/c/x.txt')).toBe(true)
  expect(match('a/b/c/d/x.txt')).toBe(true)
})

test('createMatcher() works with weird case 2', () => {
  const match = createMatcher('*/b/*/**')

  expect(match('x.txt')).toBe(false)
  expect(match('a/x.txt')).toBe(false)
  expect(match('a/b/x.txt')).toBe(false)
  expect(match('a/b/c/x.txt')).toBe(true)
  expect(match('a/b/c/d/x.txt')).toBe(true)
})

test('createMatcher() with no arguments behaves like "**"', () => {
  const match = createMatcher(undefined)

  expect(match('a.css')).toBe(true)
  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
})

test('createMatcher() works with functions, coercing the result to boolean', () => {
  const match = createMatcher(file => (file === 'foo' ? 1 : undefined))

  expect(match('foo')).toBe(true)
  expect(match('bar')).toBe(false)
})

test('createMatcher() works with regular expressions', () => {
  const match = createMatcher(/\.css$/)

  expect(match('a.css')).toBe(true)
  expect(match('a.html')).toBe(false)
})
