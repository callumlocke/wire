// Based on https://github.com/patrickkettner/filesize-parser/blob/7938b23701b4e87bdb7587a355eba0fd238b947f/index.js

import { assert } from '../deps.ts'

const validAmount = (n: string): boolean =>
  !Number.isNaN(parseFloat(n)) && Number.isFinite(Number(n))

const parsableUnit = (u: string): boolean => {
  const r = u.match(/\D*/)
  assert(r !== null, 'Invalid unit')
  return r.pop() === u
}

const incrementBases = {
  2: [
    [['b', 'bit', 'bits'], 1 / 8],
    [['B', 'Byte', 'Bytes', 'bytes'], 1],
    [['Kb'], 128],
    [['k', 'K', 'kb', 'KB', 'KiB', 'Ki', 'ki'], 1024],
    [['Mb'], 131072],
    [['m', 'M', 'mb', 'MB', 'MiB', 'Mi', 'mi'], Math.pow(1024, 2)],
    [['Gb'], 1.342e8],
    [['g', 'G', 'gb', 'GB', 'GiB', 'Gi', 'gi'], Math.pow(1024, 3)],
    [['Tb'], 1.374e11],
    [['t', 'T', 'tb', 'TB', 'TiB', 'Ti', 'ti'], Math.pow(1024, 4)],
    [['Pb'], 1.407e14],
    [['p', 'P', 'pb', 'PB', 'PiB', 'Pi', 'pi'], Math.pow(1024, 5)],
    [['Eb'], 1.441e17],
    [['e', 'E', 'eb', 'EB', 'EiB', 'Ei', 'ei'], Math.pow(1024, 6)],
  ],
  10: [
    [['b', 'bit', 'bits'], 1 / 8],
    [['B', 'Byte', 'Bytes', 'bytes'], 1],
    [['Kb'], 125],
    [['k', 'K', 'kb', 'KB', 'KiB', 'Ki', 'ki'], 1000],
    [['Mb'], 125000],
    [['m', 'M', 'mb', 'MB', 'MiB', 'Mi', 'mi'], 1.0e6],
    [['Gb'], 1.25e8],
    [['g', 'G', 'gb', 'GB', 'GiB', 'Gi', 'gi'], 1.0e9],
    [['Tb'], 1.25e11],
    [['t', 'T', 'tb', 'TB', 'TiB', 'Ti', 'ti'], 1.0e12],
    [['Pb'], 1.25e14],
    [['p', 'P', 'pb', 'PB', 'PiB', 'Pi', 'pi'], 1.0e15],
    [['Eb'], 1.25e17],
    [['e', 'E', 'eb', 'EB', 'EiB', 'Ei', 'ei'], 1.0e18],
  ],
} as const

/** Parses a filesize string like "10KB" and returns the number of bytes. */
export const parseFilesize = (input: string | number, base: 2 | 10 = 2) => {
  const parsed = String(input).match(/^([0-9\.,]*)(?:\s*)?(.*)$/)
  if (!parsed) throw new Error(`Invalid filesize string: ${input}`)

  const amount = parsed[1].replace(',', '.')
  const unit = parsed[2]

  const validUnit = (sourceUnit: string) => sourceUnit === unit

  if (!validAmount(amount) || !parsableUnit(unit))
    throw "Can't interpret " + (input || 'a blank string')

  if (unit === '') return Math.round(Number(amount))

  const increments = incrementBases[base]

  for (let i = 0; i < increments.length; i++) {
    const increment = increments[i]

    if (increment[0].some(validUnit))
      return Math.round(Number(amount) * increment[1])
  }

  throw unit + " doesn't appear to be a valid unit"
}
