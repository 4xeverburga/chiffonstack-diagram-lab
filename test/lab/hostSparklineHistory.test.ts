import { describe, expect, it } from 'vitest'
import { createInitialSparklineHistory, pushSparklineSample } from '../../src/lab/hostSparklineHistory'

describe('createInitialSparklineHistory', () => {
  it('starts empty', () => {
    expect(createInitialSparklineHistory()).toEqual({ samples: [] })
  })
})

describe('pushSparklineSample', () => {
  it('appends samples in order while under maxLength', () => {
    let state = createInitialSparklineHistory()
    state = pushSparklineSample(state, 10, 5)
    state = pushSparklineSample(state, 20, 5)
    state = pushSparklineSample(state, 30, 5)
    expect(state.samples).toEqual([10, 20, 30])
  })

  it('trims from the front once over maxLength, keeping the most recent samples', () => {
    let state = createInitialSparklineHistory()
    for (const value of [1, 2, 3, 4, 5, 6]) {
      state = pushSparklineSample(state, value, 4)
    }
    expect(state.samples).toEqual([3, 4, 5, 6])
  })

  it('never exceeds maxLength across many pushes', () => {
    let state = createInitialSparklineHistory()
    for (let i = 0; i < 100; i += 1) {
      state = pushSparklineSample(state, i, 30)
      expect(state.samples.length).toBeLessThanOrEqual(30)
    }
    expect(state.samples).toHaveLength(30)
    expect(state.samples.at(-1)).toBe(99)
  })

  it('does not mutate the previous state object (immutable in/out)', () => {
    const initial = createInitialSparklineHistory()
    const next = pushSparklineSample(initial, 5, 10)
    expect(initial.samples).toEqual([])
    expect(next.samples).toEqual([5])
    expect(next).not.toBe(initial)
  })

  it('degrades to empty history for a non-positive maxLength instead of throwing', () => {
    let state = pushSparklineSample(createInitialSparklineHistory(), 1, 0)
    expect(state.samples).toEqual([])
    state = pushSparklineSample(state, 2, -3)
    expect(state.samples).toEqual([])
  })
})
