import { describe, expect, test } from 'bun:test'
import { castSnapshot } from '../castSnapshot'
import { filterFiles } from '../filterFiles'

describe('filterFiles()', () => {
  const input = castSnapshot({
    'src/main.js': 'source',
    'src/main.test.js': 'test',
    'style.css': 'styles',
    'README.md': 'readme',
  })

  test('filters by glob and preserves buffer references without changing the input', () => {
    const output = filterFiles(input, 'src/**/*.js')

    expect(output).toEqual({
      'src/main.js': Buffer.from('source'),
      'src/main.test.js': Buffer.from('test'),
    })
    expect(output).not.toBe(input)
    expect(output['src/main.js']).toBe(input['src/main.js'])
    expect(output['src/main.test.js']).toBe(input['src/main.test.js'])
    expect(Object.keys(input)).toHaveLength(4)
  })

  test('supports ordered positive and negative globs', () => {
    expect(filterFiles(input, ['**/*.js', '!**/*.test.js', '*.css'])).toEqual({
      'src/main.js': Buffer.from('source'),
      'style.css': Buffer.from('styles'),
    })
  })

  test('supports regular expressions', () => {
    expect(filterFiles(input, /\.(css|md)$/)).toEqual({
      'style.css': Buffer.from('styles'),
      'README.md': Buffer.from('readme'),
    })
  })

  test('passes file names to predicate filters', () => {
    const names: string[] = []
    const output = filterFiles(input, (name) => {
      names.push(name)
      return name === 'README.md'
    })

    expect(names).toEqual(Object.keys(input))
    expect(output).toEqual({ 'README.md': Buffer.from('readme') })
  })

  test.each([true, false])('supports the boolean filter %s', (filter) => {
    expect(filterFiles(input, filter)).toEqual(filter ? input : {})
  })

  test('returns an empty snapshot for empty input or no matches', () => {
    expect(filterFiles({}, true)).toEqual({})
    expect(filterFiles(input, '**/*.html')).toEqual({})
  })
})
