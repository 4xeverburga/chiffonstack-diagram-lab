import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGMOID_MAPPING_CONFIG, DEFAULT_FLOW_SMOOTHING_CONFIG } from '../../../src/lab/animation/trafficScalePresets'
import { mapThroughputToAnimation } from '../../../src/lab/animation/sigmoidMapping'
import { createInitialFlowAnimationState, updateFlowAnimationState, type FlowSmoothingConfig } from '../../../src/lab/animation/flowAnimationSmoothing'

const mappingConfig = DEFAULT_SIGMOID_MAPPING_CONFIG

describe('updateFlowAnimationState', () => {
  it('snaps the very first sample straight to its mapped value with no delay', () => {
    const initial = createInitialFlowAnimationState(mappingConfig)
    const next = updateFlowAnimationState(initial, 100, 0, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    expect(next.committed).toEqual(mapThroughputToAnimation(100, mappingConfig))
    expect(next.emaThroughputPerSec).toBe(100)
    expect(next.lastCommitAtMs).toBe(0)
  })

  it('holds the committed animation steady while throughput stays within the noise band', () => {
    let state = createInitialFlowAnimationState(mappingConfig)
    let now = 0
    // Warm up the baseline around 10 req/s with small Poisson-like wobble.
    for (const sample of [10, 9, 11, 10, 8, 12, 10, 9, 11, 10]) {
      state = updateFlowAnimationState(state, sample, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
      now += 200
    }
    const committedAfterWarmup = state.committed
    // A small wobble within the noise band should not move the committed animation.
    state = updateFlowAnimationState(state, 12, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    expect(state.committed).toBe(committedAfterWarmup)
  })

  it('does not commit a significant deviation before the hold time has elapsed', () => {
    let state = createInitialFlowAnimationState(mappingConfig)
    let now = 0
    for (const sample of [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]) {
      state = updateFlowAnimationState(state, sample, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
      now += 200
    }
    const beforeSpike = state.committed
    // Spike to 100 req/s immediately after the last commit — should not
    // commit yet even though it is clearly > 2 sigma away.
    now += 200
    state = updateFlowAnimationState(state, 100, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    expect(state.committed).toBe(beforeSpike)
  })

  it('commits a sustained significant deviation once the hold time has elapsed', () => {
    let state = createInitialFlowAnimationState(mappingConfig)
    let now = 0
    for (const sample of [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]) {
      state = updateFlowAnimationState(state, sample, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
      now += 200
    }
    // Keep feeding a sustained high rate past the 3s hold window.
    for (let i = 0; i < 20; i += 1) {
      now += 200
      state = updateFlowAnimationState(state, 100, now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    }
    expect(state.committed.durationSec).toBeLessThan(mapThroughputToAnimation(10, mappingConfig).durationSec)
  })

  it('never commits more often than once every holdMs regardless of how noisy the input is', () => {
    let state = createInitialFlowAnimationState(mappingConfig)
    let now = 0
    let commits = 0
    let lastCommittedRef = state.committed
    const samples = [10, 200, 5, 300, 1, 500, 20, 400, 0, 250]
    for (let i = 0; i < 200; i += 1) {
      state = updateFlowAnimationState(state, samples[i % samples.length], now, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
      if (state.committed !== lastCommittedRef) {
        commits += 1
        lastCommittedRef = state.committed
      }
      now += 200
    }
    // 200 ticks * 200ms = 40s of simulated time; a 3s hold caps commits at
    // roughly 40/3 ~= 13, plus the initial snap. Generous upper bound to
    // avoid a flaky test while still catching a broken hold gate.
    expect(commits).toBeLessThanOrEqual(15)
  })

  it('is a pure function: identical inputs always produce identical (deep-equal) output', () => {
    const initial = createInitialFlowAnimationState(mappingConfig)
    const a = updateFlowAnimationState(initial, 42, 1000, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    const b = updateFlowAnimationState(initial, 42, 1000, DEFAULT_FLOW_SMOOTHING_CONFIG, mappingConfig)
    expect(a).toEqual(b)
  })

  it('respects a custom sigmaThreshold/holdMs configuration', () => {
    const strict: FlowSmoothingConfig = { ...DEFAULT_FLOW_SMOOTHING_CONFIG, sigmaThreshold: 100, holdMs: 0 }
    let state = createInitialFlowAnimationState(mappingConfig)
    state = updateFlowAnimationState(state, 10, 0, strict, mappingConfig)
    const afterFirst = state.committed
    // With an absurdly high sigma threshold, even a huge jump never counts
    // as "significant", so the committed animation should never move again.
    state = updateFlowAnimationState(state, 10000, 200, strict, mappingConfig)
    expect(state.committed).toBe(afterFirst)
  })
})
