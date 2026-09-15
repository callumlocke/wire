import { describe, expect, mock, test } from 'bun:test'
import type { Snapshot } from '../../types'
import { branch } from '../branch'
import { castSnapshot } from '../castSnapshot'

describe('branch()', () => {
  test('passes each file to the first matching branch without changing the input', async () => {
    const input = castSnapshot({
      'src/main.js': 'source',
      'src/style.css': 'styles',
      'other.js': 'other source',
      'README.md': 'readme',
    })
    const source = mock((files: Snapshot) => ({
      'bundle.js': files['src/main.js']!,
    }))
    const javascript = mock(async (files: Snapshot) => files)

    const output = await branch({
      'src/**': source,
      '**/*.js': javascript,
    })(input)

    expect(source).toHaveBeenCalledTimes(1)
    expect(source).toHaveBeenCalledWith({
      'src/main.js': Buffer.from('source'),
      'src/style.css': Buffer.from('styles'),
    })
    expect(javascript).toHaveBeenCalledTimes(1)
    expect(javascript).toHaveBeenCalledWith({
      'other.js': Buffer.from('other source'),
    })
    expect(output).toEqual({
      'bundle.js': Buffer.from('source'),
      'other.js': Buffer.from('other source'),
      'README.md': Buffer.from('readme'),
    })
    expect(Object.keys(input)).toEqual([
      'src/main.js',
      'src/style.css',
      'other.js',
      'README.md',
    ])
  })

  test('drops unmatched files when keepUnmatched is false', async () => {
    const input = castSnapshot({ 'main.js': 'source', 'README.md': 'readme' })

    expect(await branch({ '*.js': (files) => files }, false)(input)).toEqual({
      'main.js': Buffer.from('source'),
    })
  })

  test('keeps generated files when their names collide with unmatched input', async () => {
    const output = await branch({
      '*.js': () => ({ 'README.md': Buffer.from('generated') }),
    })(castSnapshot({ 'main.js': 'source', 'README.md': 'original' }))

    expect(output).toEqual({ 'README.md': Buffer.from('generated') })
  })

  test('runs branches concurrently and merges collisions in declaration order', async () => {
    const firstCanFinish = Promise.withResolvers<void>()
    const completed: string[] = []
    const transform = branch({
      '*.js': async () => {
        await firstCanFinish.promise
        completed.push('javascript')
        return { 'bundle.txt': Buffer.from('first branch') }
      },
      '*.css': () => {
        completed.push('css')
        firstCanFinish.resolve()
        return { 'bundle.txt': Buffer.from('second branch') }
      },
    })

    const output = await transform(
      castSnapshot({ 'main.js': 'source', 'style.css': 'styles' }),
    )

    expect(completed).toEqual(['css', 'javascript'])
    expect(output).toEqual({ 'bundle.txt': Buffer.from('second branch') })
  })

  test('calls branches with an empty snapshot when no files match', async () => {
    const generate = mock(() => ({ 'generated.txt': Buffer.from('generated') }))

    expect(await branch({ '*.js': generate })({})).toEqual({
      'generated.txt': Buffer.from('generated'),
    })
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate).toHaveBeenCalledWith({})
  })

  test.each([true, false])(
    'handles no branches with keepUnmatched=%s',
    async (keepUnmatched) => {
      const input = castSnapshot({ 'file.txt': 'contents' })

      expect(await branch({}, keepUnmatched)(input)).toEqual(
        keepUnmatched ? input : {},
      )
    },
  )

  test.each([true, false])(
    'propagates branch failures (async=%s)',
    async (isAsync) => {
      const error = new Error('branch failed')
      const transform = branch({
        '**': () => {
          if (isAsync) return Promise.reject(error)
          throw error
        },
      })

      await expect(transform({})).rejects.toBe(error)
    },
  )
})
