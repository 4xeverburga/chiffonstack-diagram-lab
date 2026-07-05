import { describe, expect, it } from 'vitest'
import type { OnSelectionChangeParams } from '@xyflow/react'
import { computeHandlesVisibleNodeIds, withHandlesVisibleClass } from '../../src/lab/useHandleVisibility'

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

describe('withHandlesVisibleClass', () => {
  it('appends "handles-visible" when visible is true and the class is absent', () => {
    expect(withHandlesVisibleClass('node node-active', true)).toBe('node node-active handles-visible')
  })

  it('leaves the className untouched (no duplicate) when already present and still visible', () => {
    expect(withHandlesVisibleClass('node node-active handles-visible', true)).toBe('node node-active handles-visible')
  })

  it('strips "handles-visible" when visible is false', () => {
    expect(withHandlesVisibleClass('node node-active handles-visible', false)).toBe('node node-active')
  })

  it('is a no-op when visible is false and the class was never present', () => {
    expect(withHandlesVisibleClass('node node-active', false)).toBe('node node-active')
  })

  it('collapses repeated "handles-visible" tokens accumulated by a prior bug', () => {
    const polluted = `node node-active ${Array(30).fill('handles-visible').join(' ')}`
    expect(withHandlesVisibleClass(polluted, true)).toBe('node node-active handles-visible')
    expect(withHandlesVisibleClass(polluted, false)).toBe('node node-active')
  })

  it('handles an undefined className', () => {
    expect(withHandlesVisibleClass(undefined, true)).toBe('handles-visible')
    expect(withHandlesVisibleClass(undefined, false)).toBe('')
  })
})
