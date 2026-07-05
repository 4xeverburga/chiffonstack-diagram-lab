import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIRECTION,
  DEFAULT_THICKNESS,
  EDGE_DIRECTIONS,
  EDGE_THICKNESSES,
  THICKNESS_STROKE_WIDTH,
  edgeStyleClassNames,
  nextThickness,
  resolveDirection,
  resolveThickness,
} from '../../src/lab/edgeStyle'

describe('edge style vocabularies', () => {
  it('defines the three thickness steps and two directions with their defaults', () => {
    expect(EDGE_THICKNESSES).toEqual(['thin', 'normal', 'thick'])
    expect(EDGE_DIRECTIONS).toEqual(['forward', 'reverse'])
    expect(DEFAULT_THICKNESS).toBe('normal')
    expect(DEFAULT_DIRECTION).toBe('forward')
  })

  it('only overrides stroke width for the non-default steps', () => {
    // `normal` must NOT appear: it renders each variant's baseline width so
    // legacy diagrams keep rendering identically (edgeStyle.ts).
    expect(Object.keys(THICKNESS_STROKE_WIDTH).sort()).toEqual(['thick', 'thin'])
    expect(THICKNESS_STROKE_WIDTH.thin).toBeLessThan(THICKNESS_STROKE_WIDTH.thick)
  })
})

describe('resolveThickness / resolveDirection', () => {
  it('passes through recognized values', () => {
    expect(resolveThickness('thin')).toBe('thin')
    expect(resolveThickness('thick')).toBe('thick')
    expect(resolveDirection('reverse')).toBe('reverse')
  })

  it('falls back to the default on missing or unrecognized values', () => {
    expect(resolveThickness(undefined)).toBe('normal')
    expect(resolveThickness('extra-chunky')).toBe('normal')
    expect(resolveThickness(3)).toBe('normal')
    expect(resolveDirection(undefined)).toBe('forward')
    expect(resolveDirection('backwards')).toBe('forward')
  })
})

describe('nextThickness', () => {
  it('cycles thin → normal → thick and wraps back to thin', () => {
    expect(nextThickness('thin')).toBe('normal')
    expect(nextThickness('normal')).toBe('thick')
    expect(nextThickness('thick')).toBe('thin')
  })
})

describe('edgeStyleClassNames', () => {
  it('builds the canvas class set', () => {
    expect(edgeStyleClassNames('heat-flow', 'thick', 'forward', 'lab-edge')).toBe(
      'lab-edge lab-edge-heat-flow lab-edge-w-thick',
    )
  })

  it('builds the export class set with the reverse modifier', () => {
    expect(edgeStyleClassNames('heat-flow', 'normal', 'reverse', 'edge')).toBe(
      'edge edge-heat-flow edge-w-normal edge-reverse',
    )
  })

  it('emits the reverse class even on non-animated variants so a stored direction reapplies', () => {
    expect(edgeStyleClassNames('dashed', 'thin', 'reverse', 'edge')).toBe('edge edge-dashed edge-w-thin edge-reverse')
  })
})
