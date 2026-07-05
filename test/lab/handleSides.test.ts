import { Position } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import {
  anchorPointForSide,
  HANDLE_SIDE_POSITION,
  HANDLE_SIDES,
  isHandleSide,
  LEGACY_SOURCE_SIDE,
  LEGACY_TARGET_SIDE,
  resolveHandleSide,
} from '../../src/lab/handleSides'

describe('HANDLE_SIDES', () => {
  it('lists exactly the four sides', () => {
    expect(HANDLE_SIDES).toEqual(['top', 'bottom', 'left', 'right'])
  })
})

describe('isHandleSide', () => {
  it.each(HANDLE_SIDES)('accepts %s', (side) => {
    expect(isHandleSide(side)).toBe(true)
  })

  it('rejects unrecognized strings', () => {
    expect(isHandleSide('north')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isHandleSide(undefined)).toBe(false)
    expect(isHandleSide(null)).toBe(false)
    expect(isHandleSide(42)).toBe(false)
  })
})

describe('legacy defaults', () => {
  it('matches the pre-feature right-source/left-target anchoring', () => {
    expect(LEGACY_SOURCE_SIDE).toBe('right')
    expect(LEGACY_TARGET_SIDE).toBe('left')
  })
})

describe('resolveHandleSide', () => {
  it('returns the value when it is a valid side', () => {
    expect(resolveHandleSide('top', LEGACY_SOURCE_SIDE)).toBe('top')
  })

  it('falls back for a missing value', () => {
    expect(resolveHandleSide(undefined, LEGACY_TARGET_SIDE)).toBe('left')
  })

  it('falls back for an unrecognized value', () => {
    expect(resolveHandleSide('north', LEGACY_SOURCE_SIDE)).toBe('right')
  })
})

describe('HANDLE_SIDE_POSITION', () => {
  it('maps every side to its React Flow Position', () => {
    expect(HANDLE_SIDE_POSITION.top).toBe(Position.Top)
    expect(HANDLE_SIDE_POSITION.bottom).toBe(Position.Bottom)
    expect(HANDLE_SIDE_POSITION.left).toBe(Position.Left)
    expect(HANDLE_SIDE_POSITION.right).toBe(Position.Right)
  })
})

describe('anchorPointForSide', () => {
  const box = { x: 10, y: 20, width: 100, height: 40 }

  it('anchors "top" at top-center', () => {
    expect(anchorPointForSide(box, 'top')).toEqual({ x: 60, y: 20 })
  })

  it('anchors "bottom" at bottom-center', () => {
    expect(anchorPointForSide(box, 'bottom')).toEqual({ x: 60, y: 60 })
  })

  it('anchors "left" at left-center', () => {
    expect(anchorPointForSide(box, 'left')).toEqual({ x: 10, y: 40 })
  })

  it('anchors "right" at right-center', () => {
    expect(anchorPointForSide(box, 'right')).toEqual({ x: 110, y: 40 })
  })
})
