import { describe, expect, it } from 'vitest'
import { computeGuides, type Rect } from '../../src/lab/layout'

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height })

describe('computeGuides', () => {
  it('returns no guides and the original position when others is empty', () => {
    const dragged = rect(10, 10, 50, 50)
    const result = computeGuides(dragged, [], 6)
    expect(result.guides).toEqual([])
    expect(result.position).toEqual({ x: 10, y: 10 })
  })

  it('returns no guides and the original position when thresholdFlow is zero or negative', () => {
    const dragged = rect(10, 10, 50, 50)
    const others = [rect(11, 11, 50, 50)]
    expect(computeGuides(dragged, others, 0).guides).toEqual([])
    expect(computeGuides(dragged, others, -5).guides).toEqual([])
  })

  it('snaps the left edge to another node left edge within threshold', () => {
    // dragged.x = 10, other.x = 12 -> delta 2, within threshold 6
    const dragged = rect(10, 100, 50, 50)
    const others = [rect(12, 300, 50, 50)]
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([{ axis: 'x', at: 12, kind: 'start' }])
    expect(result.position.x).toBe(12)
    // y axis untouched (far outside threshold)
    expect(result.position.y).toBe(100)
  })

  it('snaps the dragged center to another node left edge when it is the nearest match', () => {
    const dragged = rect(0, 0, 100, 20) // edges: start=0, center=50, end=100
    const others = [rect(48, 500, 100, 20)] // other left=48, center=98, end=148; nearest to dragged's center(50) is left=48 (delta 2)
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([{ axis: 'x', at: 48, kind: 'center' }])
    expect(result.position.x).toBe(-2)
  })

  it('snaps center-to-center specifically when it is the nearest match', () => {
    const dragged = rect(0, 0, 20, 20) // center x = 10
    const others = [rect(4, 500, 12, 20)] // start=4, center=10, end=16 -> center matches exactly; y far away
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([{ axis: 'x', at: 10, kind: 'center' }])
    expect(result.position.x).toBe(0)
  })

  it('snaps independently per axis', () => {
    const dragged = rect(10, 10, 40, 40) // right=50, bottom=50, center=(30,30)
    const others = [rect(52, 200, 40, 40)] // left=52 close to dragged right=50 (delta 2, x-axis)
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toHaveLength(1)
    expect(result.guides[0]).toMatchObject({ axis: 'x', kind: 'end' })
    expect(result.position.y).toBe(10) // y untouched
  })

  it('keeps only the nearest match per axis across multiple candidates', () => {
    const dragged = rect(0, 0, 10, 10) // start=0, center=5, end=10
    const others = [
      rect(3, 100, 10, 10), // start=3 -> delta vs dragged.start(0)=3
      rect(1, 200, 10, 10), // start=1 -> delta vs dragged.start(0)=1 (nearest)
    ]
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([{ axis: 'x', at: 1, kind: 'start' }])
    expect(result.position.x).toBe(1)
  })

  it('produces no guide on an axis with no match within threshold', () => {
    const dragged = rect(0, 0, 10, 10)
    const others = [rect(1000, 1000, 10, 10)]
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([])
    expect(result.position).toEqual({ x: 0, y: 0 })
  })

  it('handles mixed-size rects correctly (large vs small node)', () => {
    const dragged = rect(0, 0, 400, 300) // edges: start=0, center=200, end=400
    const others = [rect(300, 500, 20, 20)] // small node edges: start=300, center=310, end=320 -- all far outside threshold
    const result = computeGuides(dragged, others, 6)
    expect(result.guides).toEqual([])
  })

  it('does not mutate the dragged rect or the others array', () => {
    const dragged = rect(10, 10, 50, 50)
    const others = [rect(12, 12, 50, 50)]
    const draggedCopy = { ...dragged }
    const othersCopy = others.map((r) => ({ ...r }))
    computeGuides(dragged, others, 6)
    expect(dragged).toEqual(draggedCopy)
    expect(others).toEqual(othersCopy)
  })

  it('is deterministic for the same inputs', () => {
    const dragged = rect(10, 10, 50, 50)
    const others = [rect(12, 12, 50, 50), rect(60, 60, 20, 20)]
    const first = computeGuides(dragged, others, 6)
    const second = computeGuides(dragged, others, 6)
    expect(second).toEqual(first)
  })
})
