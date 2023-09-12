import { z } from 'zod'

/** Validates a node Buffer */
const bufferSchema = z.custom<Buffer>((val) => Buffer.isBuffer(val))

/** Validates a filemap */
export const filemapSchema = z.record(bufferSchema)

/** Validates a filemappish object */
export const filemappishSchema = z.record(
  z.union([bufferSchema, z.string()]).nullish()
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
