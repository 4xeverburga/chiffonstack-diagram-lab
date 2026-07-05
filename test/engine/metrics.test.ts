import { describe, expect, it } from 'vitest'
import { buildMetricsWindow } from '../../src/engine/metrics'

describe('buildMetricsWindow', () => {
  it('scales departures to a per-second throughput using the window size', () => {
    const window = buildMetricsWindow({
      windowEndSimTimeMs: 200,
      windowSizeMs: 200,
      nodeDepartures: new Map([['processor', 20]]),
      nodeQueueDepths: new Map([['processor', 5]]),
      edgeCrossings: new Map(),
    })
    // 20 departures in a 200ms window -> 100/sec.
    expect(window.nodes.processor.throughputPerSec).toBeCloseTo(100)
    expect(window.nodes.processor.queueDepth).toBe(5)
  })

  it('reports zero throughput for a node with no departures this window', () => {
    const window = buildMetricsWindow({
      windowEndSimTimeMs: 200,
      windowSizeMs: 200,
      nodeDepartures: new Map(),
      nodeQueueDepths: new Map([['sink', 0]]),
      edgeCrossings: new Map(),
    })
    expect(window.nodes.sink.throughputPerSec).toBe(0)
    expect(window.nodes.sink.queueDepth).toBe(0)
  })

  it('scales edge crossings to a per-second throughput', () => {
    const window = buildMetricsWindow({
      windowEndSimTimeMs: 200,
      windowSizeMs: 200,
      nodeDepartures: new Map(),
      nodeQueueDepths: new Map(),
      edgeCrossings: new Map([['e1', 40]]),
    })
    expect(window.edges.e1.throughputPerSec).toBeCloseTo(200)
  })

  it('carries the window end sim time through unchanged', () => {
    const window = buildMetricsWindow({
      windowEndSimTimeMs: 12345,
      windowSizeMs: 200,
      nodeDepartures: new Map(),
      nodeQueueDepths: new Map(),
      edgeCrossings: new Map(),
    })
    expect(window.windowEndSimTimeMs).toBe(12345)
  })

  it('only reports nodes present in nodeQueueDepths (the full simulated node set)', () => {
    const window = buildMetricsWindow({
      windowEndSimTimeMs: 200,
      windowSizeMs: 200,
      nodeDepartures: new Map([['ghost', 10]]),
      nodeQueueDepths: new Map([['real', 0]]),
      edgeCrossings: new Map(),
    })
    expect(Object.keys(window.nodes)).toEqual(['real'])
  })
})
