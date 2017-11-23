// @flow

import path from 'path'
import invariant from 'invariant'
import Bluebird from 'bluebird'
import JoinTable from 'join-table'
import { castFilemap, diff, singleFile } from '.'
import type { GranularBuildFunction, AsyncTransform, Filemap } from '.'

/**
 * Returns an async transform that, when passed a filemap, runs your callback once for every file
 * in the filemap. Your callback decides what to output on behalf of the given file – it may output
 * the file as-is, or a buffer/string of new contents to replace the file, or `null` to exclude
 * that file from the output, or a plain object detailing new files to output instead.
 *
 * The returned transform retains a memo of which output files were triggered by which input files on each invocation. It uses this, in combination with a diff comparing the incoming filemap to the incoming filemap from the previous invocation, to determine which files actually need to be built again. In many cases it's just one or two files, and their results are simply combined with the output from the previous invocation.
 *
 * @public
 */

const cache = (fn: GranularBuildFunction): AsyncTransform => {
  let importations = new JoinTable()
  let dependencies = new JoinTable()
  let rememberedInput: Filemap
  let rememberedOutput: Filemap

  const cachingTransform = singleFile(async (_input) => {
    // normalize input
    const input = castFilemap(_input)

    // get things from last time
    const oldInput = rememberedInput
    const oldImportations = importations
    const oldDependencies = dependencies

    // start new join tables for this build
    const newImportations = new JoinTable() // <L: buildPath, R: importPath>
    const newDependencies = new JoinTable() // <L: buildPath, R: outputPath>

    // determine which input files have changed since last time
    const changedInput = oldInput ? diff(oldInput, input) : input

    // decide which files we need to build
    const filesToBuild = changedInput.withMutations((map) => {
      // add any files that are known to import any of these files
      for (const [buildPath, importPath] of oldImportations) {
        if (changedInput.has(importPath)) {
          map.set(buildPath, input.get(buildPath) || null)
        }
      }
    })

    // build everything
    const results: {
      [name: string]: ?Buffer | ?string,
    } = await Bluebird.props(filesToBuild
      .filter(content => content)
      .map((content, buildPath) => {
        const include = (importee) => {
          // console.assert(
          //   !path.isAbsolute(importee),
          //   'importFile should not be used for absolute paths'
          // );

          newImportations.add(buildPath, importee)

          return input.get(importee) || null
        }

        if (Buffer.isBuffer(content)) {
          // workaround until flow understands that Buffer.isBuffer refines the type
          if (!(content instanceof Buffer)) throw new Error('flow hack')

          return Bluebird.resolve().then(() =>
            fn.call(null, content, buildPath, include))
        }

        throw new TypeError('bug')
      })
      .toObject())

    // record output paths so we can check that no path gets output from two different inputs
    const allOutputPaths = {} // {[outputPath]: buildPath}

    // process the results to determine output
    const outputWrites: { [name: string]: Buffer } = {}
    for (const buildPath of filesToBuild.keys()) {
      let result = results[buildPath]

      if (!result) continue

      // normalise the structure of the result - if it's a buffer or string,
      // this is an instruction to output to the exact same path
      if (Buffer.isBuffer(result) || typeof result === 'string') {
        const newContents = result
        result = { [buildPath]: newContents }
      } else if (typeof result !== 'object') {
        throw new TypeError("wire cache: Callback's return value is of invalid type " +
            `(${typeof result}) when building "${buildPath}"`)
      }

      // process the result for this file
      const outputPaths = Object.keys(result)
      for (let outputPath of outputPaths) {
        // first ensure this output path is uniquely output by a single input path
        // (because if we were to just pick one, results might be undeterministic)
        {
          const otherInputFile = allOutputPaths[outputPath]

          if (otherInputFile) {
            throw new Error(`wire cache: When building "${buildPath}"` +
                `the fn tried to output to "${
                  outputPath
                }", but this has already ` +
                `been output by "${otherInputFile}"`)
          }

          allOutputPaths[outputPath] = buildPath
        }

        // make sure it's a buffer
        // $FlowFixMe https://stackoverflow.com/questions/45793573/indexable-signature-not-found-in-object-literal-in-flow
        let content = result[outputPath]
        if (typeof content === 'string') {
          content = Buffer.from(content)
        } else if (!Buffer.isBuffer(content)) {
          throw new TypeError(`wire cache: Expected value for output file "${outputPath}" ` +
              `to be string or buffer; got ${typeof content}.`)
        }

        // make sure the path is normal (should be relative, with no "./" or "../")
        if (path.isAbsolute(outputPath)) {
          throw new Error(`wire cache: Expected a relative path, got: ${outputPath}`)
        }
        outputPath = path.normalize(outputPath)

        invariant(
          typeof content === 'object',
          "flow thinks this might be a number, and asserting Buffer.isBuffer doesn't seem to work",
        )

        // add it to the output
        outputWrites[outputPath] = content

        // and note the new causation
        newDependencies.add(buildPath, outputPath)
      }
    }

    // status: the output now contains everything that got written on this build
    // - but we also need to return all other *unaffected* files at the end.

    // fill in the gaps in the new mappings (dependencies and importations) with
    // those from the previous build - i.e. any where the build path was not
    // rebuilt this time
    {
      // carry over output mappings
      for (const [oldBuildPath, oldOutputPath] of oldDependencies) {
        if (!filesToBuild.has(oldBuildPath)) {
          newDependencies.add(oldBuildPath, oldOutputPath)
        }
      }

      // carry over import mappings
      for (const [oldBuildPath, oldResolvedImportPath] of oldImportations) {
        if (!filesToBuild.has(oldBuildPath)) {
          newImportations.add(oldBuildPath, oldResolvedImportPath)
        }
      }
    }

    // see what needs deleting - anything that was output last build, but
    // was *not* output on this build
    const toDelete = new Set()
    {
      const oldOutputPaths = oldDependencies.getRights()
      const newOutputPaths = newDependencies.getRights()
      for (const file of oldOutputPaths) {
        if (!newOutputPaths.has(file)) toDelete.add(file)
      }
    }

    // augment the output with output from last time - carry over anything that
    // wasn't output this time and isn't in toDelete
    if (rememberedOutput) {
      rememberedOutput.forEach((content, file) => {
        // console.assert(Buffer.isBuffer(content));

        if (!outputWrites[file] && !toDelete.has(file)) {
          outputWrites[file] = content
        }
      })
    }

    // finalise output
    const output = (castFilemap(outputWrites): Filemap)

    // remember state for next time
    importations = newImportations
    dependencies = newDependencies
    rememberedInput = input
    rememberedOutput = output

    return (output: Filemap)
  })

  // $FlowFixMe: not sure why it can't accept these match
  ;(cachingTransform: AsyncTransform)

  return cachingTransform
}

export default cache
