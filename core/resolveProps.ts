type AwaitedValues<T> = {
  [K in keyof T]: Awaited<T[K]>
}

/**
 * Like `Promise.all` but for objects instead of arrays. The returned promise resolves to an object that has the same keys as the input object, but with all the values awaited.
 */

export const resolveProps = async <Input extends Record<string, unknown>>(
  inputObject: Input
): Promise<AwaitedValues<Input>> => {
  const keys = Object.keys(inputObject) as (keyof Input)[]
  const values = Object.values(inputObject) as Input[keyof Input][]

  const awaitedValues = await Promise.all(values)

  const result = {} as AwaitedValues<Input>
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = awaitedValues[i]
  }

  return result
}
