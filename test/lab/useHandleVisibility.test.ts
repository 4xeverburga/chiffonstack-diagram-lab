import { describe, expect, it } from 'vitest'
import type { OnSelectionChangeParams } from '@xyflow/react'
import { computeHandlesVisibleNodeIds } from '../../src/lab/useHandleVisibility'

function selection(overrides: Partial<OnSelectionChangeParams>): OnSelectionChangeParams {
  return { nodes: [], edges: [], ...overrides }
}

describe('computeHandlesVisibleNodeIds', () => {
  it('returns an empty set when nothing is selected', () => {
    expect(computeHandlesVisibleNodeIds(selection({}))).toEqual(new Set())
  })

  it('includes a selected node\'s own id', () => {
    const result = computeHandlesVisibleNodeIds(
      selection({ nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {} }] }),
    )
    expect(result).toEqual(new Set(['a']))
  })

  it('includes both endpoint ids of a selected edge', () => {
    const result = computeHandlesVisibleNodeIds(
      selection({ edges: [{ id: 'e1', source: 'a', target: 'b' }] }),
    )
    expect(result).toEqual(new Set(['a', 'b']))
  })

  it('dedupes ids shared by a selected node and a selected edge', () => {
    const result = computeHandlesVisibleNodeIds(
      selection({
        nodes: [{ id: 'a', position: { x: 0, y: 0 }, data: {} }],
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      }),
    )
    expect(result).toEqual(new Set(['a', 'b']))
  })
})
