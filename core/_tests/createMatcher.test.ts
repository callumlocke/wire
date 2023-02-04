import { expect } from '../../deps_test.ts'
import { createMatcher } from '../createMatcher.ts'

Deno.test('createMatcher works with a glob', () => {
  const match = createMatcher('foo/**/*.css')

  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
  expect(match('a.css')).toBe(false)
  expect(match('a/b/c/d.css')).toBe(false)
  expect(match('a/b/c/d.html')).toBe(false)

  // dotfiles can be matched (cf. minimatch default behaviour)
  expect(match('foo/a/b/c/.d.css')).toBe(true)
})

Deno.test('createMatcher works with an array of globs', () => {
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

Deno.test('createMatcher works with weird but valid globs', () => {
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

Deno.test('createMatcher behaves like "**" if no pattern given', () => {
  const match = createMatcher(undefined)

  expect(match('a.css')).toBe(true)
  expect(match('foo/a.css')).toBe(true)
  expect(match('foo/a/b/c/d.css')).toBe(true)
})

Deno.test(
  'createMatcher works with functions, coercing the result to boolean',
  () => {
    const match = createMatcher((file) => (file === 'foo' ? 1 : undefined))

    expect(match('foo')).toBe(true)
    expect(match('bar')).toBe(false)
  }
)

Deno.test('createMatcher works with regular expressions', () => {
  const match = createMatcher(/\.css$/)

  expect(match('a.css')).toBe(true)
  expect(match('a.html')).toBe(false)
})
