import * as z from 'zod/mini'

/** Validates a node Buffer */
const bufferSchema = z.custom<Buffer>((val) => Buffer.isBuffer(val))

/** Validates a filemap */
export const filemapSchema = z.record(z.string(), bufferSchema)

/** Validates a filemappish object */
export const filemappishSchema = z.record(
  z.string(),
  z.nullish(z.union([bufferSchema, z.string()])),
)

/** Validates a transform function. Use .implementAsync() for async transforms. */
export const transformSchema = z.function({
  input: [filemapSchema],
  output: filemapSchema,
})

/** Validates a matchable */
export const matchableSchema = z.union([
  z.instanceof(RegExp),
  z.array(z.string()),
  z.string(),
  z.boolean(),
  z.null(),
  z.function({ input: [z.string()] }),
])
