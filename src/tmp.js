// @flow

/**
 * Creates a transform that allows your callback to modify real files on disk. Good for wiring up
 * CLI tools that are designed to work with a real directory structure.
 *
 *
 *
 * Important: your callback must not modify anything in the input directory, or everything will
 * break.
 *
 * ```
 * tmp((input, output) => {
 *   // input is the path to a tmp directory containing the incoming files.
 *   // output is a path to an empty tmp directory, to which you should write your outgoing files.
 * })
 * ```
 */

import path from 'path'
import tempy from 'tempy'
import { Directory, singleFile } from '.'

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
