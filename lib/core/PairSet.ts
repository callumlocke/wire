/**
 * A 'set' of **ordered pairs**, also known as "2-tuples.
 *
 * The API is based on `Set`, but the `add`, `has` and `delete` methods each take two arguments instead of one. As with the native `Set`, adding an existing pair has no effect. For comparison purposes, order matters - `[a,b]` and `[b,a]` are considered different pairs.
 */

export class PairSet<L = string, R = string> implements Iterable<[L, R]> {
  private _size = 0
  private _lefts: L[] = []
  private _rights: R[] = []

  /** How many pairs are in the set. */
  get size(): number {
    return this._size
  }

  /** Prevent overwriting the size property. */
  set size(_value: number) {
    // eslint-disable-line no-unused-vars, class-methods-use-this
    throw new Error('PairSet: size property is not writable')
  }

  /** Empties the set. */
  clear(): void {
    this._size = 0
    this._lefts.length = 0
    this._rights.length = 0
  }

  /** Checks if a given pair is in the set. */
  has(left: L, right: R): boolean {
    const { _lefts, _rights, _size } = this

    for (let i = 0; i < _size; i += 1) {
      if (_lefts[i] === left && _rights[i] === right) return true
    }

    return false
  }

  /** Adds a new pair to the set. Has no effect if the pair already exists. */
  add(left: L, right: R): this {
    const { _lefts, _rights, _size } = this

    // if this pair already exists, do nothing
    for (let i = 0; i < _size; i += 1) {
      if (_lefts[i] === left && _rights[i] === right) return this
    }

    // add the new pair
    _lefts[_size] = left
    _rights[_size] = right
    this._size += 1

    return this
  }

  /**
   * Removes a pair from the set. Has no effect if the pair does not exist.
   */
  delete(left: L, right: R): boolean {
    const { _lefts, _rights, _size } = this

    for (let i = 0; i < _size; i += 1) {
      if (_lefts[i] === left && _rights[i] === right) {
        const finalIndex = _size - 1
        _lefts[i] = _lefts[finalIndex] as L
        _rights[i] = _rights[finalIndex] as R
        _lefts.length = finalIndex
        _rights.length = finalIndex
        this._size = finalIndex
        return true
      }
    }

    return false
  }

  /** Get the set of all 'left' values that are paired with the given 'right' value. */
  getLeftsFor(right: R): Set<L> {
    const { _lefts, _rights, _size } = this

    const results = new Set<L>()

    for (let i = 0; i < _size; i += 1) {
      if (_rights[i] === right) results.add(_lefts[i] as L)
    }

    return results
  }

  /** Get the set of all 'right' values that are paired with the given 'left' value. */
  getRightsFor(left: L): Set<R> {
    const { _lefts, _rights, _size } = this

    const results = new Set<R>()

    for (let i = 0; i < _size; i += 1) {
      if (_lefts[i] === left) results.add(_rights[i] as R)
    }

    return results
  }

  /** Get the set of all the 'left' values. */
  getLefts(): Set<L> {
    return new Set(this._lefts)
  }

  /** Get the set of all the 'right' values. */
  getRights(): Set<R> {
    return new Set(this._rights)
  }

  /** Returns a string for debugging (works with console.log() etc.) */
  inspect(): string {
    return `PairSet[${this._size} pairs]`
  }

  /** Each iteration receives a two-item array in the form `[left, right]`. */
  [Symbol.iterator](): Iterator<[L, R], void> {
    const { _lefts, _rights, _size } = this

    const finalIndex = _size - 1
    let index = 0

    return {
      next: () => {
        if (index > finalIndex) return { done: true, value: undefined }

        const result: { value: [L, R] } = {
          value: [_lefts[index] as L, _rights[index] as R],
        }

        index += 1

        return result
      },
    }
  }
}
