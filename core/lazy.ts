import pathUtil from 'path'
import { produce } from 'immer'
import type {
  LazyBuilder,
  Transform,
  Filemap,
  Includer,
  LazyBuildresult,
} from '../types'
import { castFilemap } from './castFilemap'
import { diff } from './diff'
import { PairSet } from './PairSet'
import { resolveProps } from './resolveProps'

/**
 * Returns an async transform that, when passed a filemap, runs your callback once for every file. Your callback decides what to output for the given input file – it may output the file as-is, or a buffer/string of new contents to replace the file, or `null` to exclude that file from the output, or a plain object detailing multiple files to output instead of the original file.
 *
 * The returned transform retains an internal memo of which output files were triggered by which input files on each invocation. It uses this, in combination with a diff comparing the incoming filemap to the incoming filemap from the previous invocation, to determine which files actually need to be built again after a change (even if the change was to an included file, rather than the file itself). In many cases it's just one or two files, and their results are simply combined with the output from the previous invocation.
 *
 * @public
 */

export const lazy = (fn: LazyBuilder): Transform => {
  let importations = new PairSet()
  let dependencies = new PairSet()
  let rememberedInput: Filemap
  let rememberedOutput: Filemap
  let queue = Promise.resolve(castFilemap())

  const lazyTransform: Transform = (_input) => {
    queue = queue.then(async () => {
      // normalize input
      const input = castFilemap(_input)

      // get things from last time
      const oldInput = rememberedInput
      const oldImportations = importations
      const oldDependencies = dependencies

      // start new join tables for this build
      const newImportations = new PairSet() // <L: buildPath, R: importPath>
      const newDependencies = new PairSet() // <L: buildPath, R: outputPath>

      // determine which input files have changed since last time
      const changedInput = oldInput ? diff(oldInput, input) : input

      // decide which files we need to build - produce a copy of the changedInput patch, adding any files that, on the previous call, imported any file that has changed on _this_ call
      const filesToBuild = produce(changedInput, (draft) => {
        for (const [buildPath, importPath] of oldImportations) {
          if (changedInput[importPath]) {
            draft[buildPath] = input[buildPath] || null
          }
        }
      })

      // create list of file names affected by the updated patch, including for deleted files (null values), plus augmented with anything from the previous build that imported anything changed on this call
      const namesAffectedByBuild = Object.keys(filesToBuild)

      // create an object for promises, each one resolving with a LazyBuildResult, keyed by the name of the file that we want to build with the user's granular transform (typically starting with a file that got edited on disk, followed by adding entries for any other files that were either imported by this file or imported by dependencies of this file or otherwise changed/deleted)
      const promises: Record<string, Promise<LazyBuildresult>> = {}

      for (const [buildPath, content] of Object.entries(filesToBuild)) {
        if (!content) continue

        // create a unique includer function for this build of this file
        const include: Includer = (importee) => {
          if (pathUtil.isAbsolute(importee)) {
            console.warn(
              'include should not be used for absolute paths - ' + importee
            )
          }

          // Register that buildPath imports importee
          newImportations.add(buildPath, importee)

          return input[importee] || null
        }

        // add a promise for the result of the user's lazy builder, and set it to actually start on the next tick
        promises[buildPath] = Promise.resolve().then(() =>
          fn.call(null, content, buildPath, include)
        )
      }

      // await them all in parallel
      const results = await resolveProps(promises)

      // for (const [buildPath, result] of Object.entries(results)) {
      //   if (!results[buildPath]) delete results[buildPath]
      // }

      // status: the files have all been built, and we have a results object containing immediate LazyBuildResults. newImportations has been fully popuated.

      // record output paths so we can check that no path gets output from two different inputs
      const allOutputPaths: Record<string, string> = {} // {[outputPath]: buildPath}

      // process the results to determine output, using all the filesToBuild keys as build paths, putting data into outputWrites (a list of everything we need to write to disk at the end)
      const outputWrites: { [name: string]: Buffer } = {}
      const buildPaths = Object.keys(filesToBuild)

      for (const buildPath of buildPaths) {
        const r = results[buildPath]
        if (!r) continue
        let result: LazyBuildresult = r

        // normalise the result format to Record<string, Buffer | string> if not already
        if (result instanceof Buffer || typeof result === 'string') {
          const newContents = result
          result = { [buildPath]: newContents }
        } else if (typeof result !== 'object') {
          throw new TypeError(
            "wire lazy: Callback's return value is of invalid type " +
              `(${typeof result}) when building ${JSON.stringify(buildPath)}`
          )
        }

        // process the result for this file
        for (let [outputPath, content] of Object.entries(result)) {
          // first ensure this output path is uniquely output by a single input path
          // (because if we were to just pick one, results might be undeterministic)
          {
            const otherInputFile = allOutputPaths[outputPath]

            if (otherInputFile) {
              throw new Error(
                `wire lazy: When building ${JSON.stringify(buildPath)}` +
                  `the fn tried to output to ${JSON.stringify(
                    outputPath
                  )}, but this has already ` +
                  `been output by ${JSON.stringify(otherInputFile)}`
              )
            }

            allOutputPaths[outputPath] = buildPath
          }

          // make sure it's a buffer
          if (typeof content === 'string') {
            content = new TextEncoder().encode(content)
          } else if (!(content instanceof Uint8Array)) {
            throw new TypeError(
              `wire lazy: Expected value for output file "${outputPath}" ` +
                `to be string or Uint8Array; got ${typeof content}.`
            )
          }

          // make sure the path is normal (should be relative, with no "./" or "../")
          if (pathUtil.isAbsolute(outputPath)) {
            throw new Error(
              `wire lazy: Expected a relative path, got: ${outputPath}`
            )
          }
          outputPath = pathUtil.normalize(outputPath)

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
          if (!namesAffectedByBuild.includes(oldBuildPath)) {
            newDependencies.add(oldBuildPath, oldOutputPath)
          }
        }

        // carry over import mappings
        for (const [oldBuildPath, oldResolvedImportPath] of oldImportations) {
          if (!namesAffectedByBuild.includes(oldBuildPath)) {
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
        Object.entries(rememberedOutput).forEach(([file, content]) => {
          // console.assert(Buffer.isBuffer(content));

          if (!outputWrites[file] && !toDelete.has(file)) {
            outputWrites[file] = content
          }
        })
      }

      // finalise output
      const output = castFilemap(outputWrites)

      // remember state for next time
      importations = newImportations
      dependencies = newDependencies
      rememberedInput = input
      rememberedOutput = output

      return output
    })

    return queue
  }

  return lazyTransform
}
