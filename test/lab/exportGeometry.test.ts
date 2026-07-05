import { describe, expect, it } from 'vitest'
import { computeContentSize, computeEdgePaths, computeNodeBoxes } from '../../src/lab/exportGeometry'
import { anchorPointForSide, type HandleSide } from '../../src/lab/handleSides'
import { kitchenSinkEdges, kitchenSinkNodes } from './fixtures/kitchenSink'

describe('computeNodeBoxes', () => {
  it('normalizes positions so the top-left-most node sits at (0, 0)', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const xs = [...boxes.values()].map((box) => box.x)
    const ys = [...boxes.values()].map((box) => box.y)
    expect(Math.min(...xs)).toBe(0)
    expect(Math.min(...ys)).toBe(0)
  })

  it('honors a manually resized node\'s explicit width/height', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    expect(boxes.get('resized-node')).toMatchObject({ width: 220, height: 96 })
  })

  it('grows auto-sized height for a node with an image, relative to a plain node', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const plain = boxes.get('default-node')!
    const withImage = boxes.get('image-node')!
    expect(withImage.height).toBeGreaterThan(plain.height)
  })
})

describe('computeEdgePaths', () => {
  it('produces one path per edge with valid endpoints', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const paths = computeEdgePaths(kitchenSinkEdges, boxes)
    expect(paths).toHaveLength(kitchenSinkEdges.length)
    for (const path of paths) {
      expect(path.d.length).toBeGreaterThan(0)
    }
  })

  it('drops edges with a dangling source/target instead of throwing', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const dangling = [...kitchenSinkEdges, { id: 'ghost', source: 'missing', target: 'default-node', type: 'heat', data: {} }]
    const paths = computeEdgePaths(dangling, boxes)
    expect(paths.find((path) => path.id === 'ghost')).toBeUndefined()
  })

  it('is deterministic across repeat calls', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const first = computeEdgePaths(kitchenSinkEdges, boxes)
    const second = computeEdgePaths(kitchenSinkEdges, boxes)
    expect(second).toEqual(first)
  })

  it('anchors an edge with no recorded sides at the legacy right/left pair', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const sourceBox = boxes.get('default-node')!
    const targetBox = boxes.get('active-node')!
    const legacySource = anchorPointForSide(sourceBox, 'right')
    const legacyTarget = anchorPointForSide(targetBox, 'left')
    const [path] = computeEdgePaths(
      [{ id: 'e', source: 'default-node', target: 'active-node', type: 'heat', data: {} }],
      boxes,
    )
    expect(path.d.startsWith(`M${legacySource.x},${legacySource.y}`)).toBe(true)
    expect(path.d.endsWith(`${legacyTarget.x},${legacyTarget.y}`)).toBe(true)
  })

  it('anchors the path on each edge\'s recorded source/target side', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const sourceBox = boxes.get('default-node')!
    const targetBox = boxes.get('active-node')!
    const combos: Array<[HandleSide, HandleSide]> = [
      ['top', 'bottom'],
      ['left', 'right'],
      ['bottom', 'top'],
      ['right', 'left'],
    ]
    for (const [sourceHandle, targetHandle] of combos) {
      const [path] = computeEdgePaths(
        [{ id: 'e', source: 'default-node', target: 'active-node', type: 'heat', data: {}, sourceHandle, targetHandle }],
        boxes,
      )
      const expectedSource = anchorPointForSide(sourceBox, sourceHandle)
      const expectedTarget = anchorPointForSide(targetBox, targetHandle)
      expect(path.d.startsWith(`M${expectedSource.x},${expectedSource.y}`)).toBe(true)
      expect(path.d.endsWith(`${expectedTarget.x},${expectedTarget.y}`)).toBe(true)
    }
  })
})

describe('computeContentSize', () => {
  it('adds the margin to the furthest node extent', () => {
    const boxes = computeNodeBoxes(kitchenSinkNodes)
    const size = computeContentSize(boxes, 32)
    const maxX = Math.max(...[...boxes.values()].map((box) => box.x + box.width))
    expect(size.width).toBe(Math.round(maxX) + 32)
  })
})
