// @flow

/**
 * Creates a transform that allows your callback to modify files on disk. Good for wiring up CLI
 * tools that expect to work on real files on disk.
 *
 * Important: your callback must not modify anything in the input directory, or you will have
 * unpredictable results on subsequent calls to your transform.
 */

import tempy from 'tempy'

import path from 'path'

import Directory from './Directory'
import singleFile from './singleFile'

const tmp = (callback: (input: string, output: string) => void) => {
  const tmpDir = tempy.directory()
  const inputPath = path.join(tmpDir, 'input')
  const outputPath = path.join(tmpDir, 'output')

  const inputDir = new Directory(inputPath, { force: true })
  const outputDir = new Directory(outputPath, { force: true })

  return singleFile(async (files) => {
    await inputDir.write(files)

    await callback(inputPath, outputPath)

    return outputDir.read()
  })
}

export default tmp
