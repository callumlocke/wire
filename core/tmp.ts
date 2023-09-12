import pathUtil from 'path'
import { Directory } from './Directory'
import { singleFile } from './singleFile'
import { Filemap } from '../types'
import { ensureDir } from './ensureDir'
import { emptyDir } from './emptyDir'

/**
 * Creates a transform that allows your callback to modify files on disk. Intended for wiring up CLI tools that expect to work on real files on a filesystem and don't provide an interface to work with `lazy` `include` callbacks.
 *
 * Your async callback is passed two `Directory` instances, `input` and `output`. By the time you are passed them on the first call of your transform, the input is guaranteed to be primed - usually in `./.wire/tmp/$NAME` relative to the CWD.
 *
 * Your callback's job is to write something in the `output` directory. As an example, to make a no-op transform using tmp, you could run an rsync command to copy all files from src to dist.
 *
 * The `output` directory is empty the first time your transform is called, but it is **not** cleared out for subsequent calls, so you can optimise incremental builds by avoiding re-creating files that you don't want. But this means you need to be careful about removing files that are no longer needed - many build tools are crap at this.
 *
 * Your async callback should read files from the `input` directory and write files in the `output` directory, before returning/resolving. Subsequent calls in a `dir.watch()` session automatically update the `input` directory to reflect the incoming filemap each time before calling your callback, but they do NOT update the output dir, so you should consider if you need to empty the output dir as a first step during your callback.
 *
 * Important: your callback must not modify anything in the input directory, or you will have
 * unpredictable results on subsequent calls to your transform.
 */

export const tmp = (
  callback: (
    input: Directory,
    output: Directory,
    names: Set<string>
  ) => Promise<void> | void,
  root?: string
) => {
  const tmpRoot = root ? root : pathUtil.resolve(process.cwd(), '.wire', 'tmp')
  const inputPath = pathUtil.resolve(tmpRoot, 'input')
  const outputPath = pathUtil.resolve(tmpRoot, 'output')

  let started = false

  const inputDir = new Directory(inputPath, { force: true })
  const outputDir = new Directory(outputPath, { force: true })

  return singleFile(async (files: Filemap) => {
    if (!started) {
      started = true
      // emptying input dir is not necessary as this will be done by the first call to `inputDir.write()`, which is more efficient in the common case where some files are unchanged
      await Promise.all([ensureDir(inputPath), emptyDir(outputPath)])
    }

    await inputDir.write(files)

    await callback(inputDir, outputDir, new Set(Object.keys(files)))

    return outputDir.read()
  })
}
