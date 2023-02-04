import { z } from './deps.ts'

/** Validates a filemap */
export const filemapSchema = z.record(z.instanceof(Uint8Array))

/** Validates a filemappish object */
export const filemappishSchema = z.record(
  z.union([z.instanceof(Uint8Array), z.string()]).nullish()
)

/** Validates a transform function */
export const transformSchema = z.function(
  z.tuple([filemapSchema]),
  z.union([filemapSchema, z.promise(filemapSchema)])
)

/** Validates a matchable */
export const matchableSchema = z.union([
  z.instanceof(RegExp),
  z.array(z.string()),
  z.string(),
  z.boolean(),
  z.undefined(),
  z.null(),
  z.function().args(z.string()),
])
