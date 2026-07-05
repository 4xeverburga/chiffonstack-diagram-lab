import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { applyNodeImage } from '../../src/lab/useDiagramMutations'

function baseNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'n',
    type: 'labelNode',
    position: { x: 0, y: 0 },
    data: { label: 'n' },
    className: 'node',
    ...overrides,
  }
}

describe('applyNodeImage', () => {
  it('fits a node to a newly uploaded image (width/height/imageAspect set)', () => {
    const next = applyNodeImage(baseNode(), 'data:image/png;base64,AAAA', 400, 200)
    expect(next.data.image).toBe('data:image/png;base64,AAAA')
    expect(next.data.imageAspect).toBe(2)
    expect(next.width).toBeGreaterThan(0)
    expect(next.height).toBeGreaterThan(0)
  })

  it('re-fits an already-fitted node when its image is replaced with a different ratio', () => {
    const fitted = applyNodeImage(baseNode(), 'data:image/png;base64,AAAA', 400, 200)
    const replaced = applyNodeImage(fitted, 'data:image/png;base64,BBBB', 100, 400)
    expect(replaced.data.image).toBe('data:image/png;base64,BBBB')
    expect(replaced.data.imageAspect).toBe(0.25)
    expect(replaced.width).not.toBe(fitted.width)
    expect(replaced.height).not.toBe(fitted.height)
  })

  it('overrides a prior manual size when a new image is uploaded (upload is the newer intent)', () => {
    const manuallyResized = baseNode({ width: 500, height: 500 })
    const fitted = applyNodeImage(manuallyResized, 'data:image/png;base64,AAAA', 400, 200)
    expect(fitted.width).not.toBe(500)
    expect(fitted.height).not.toBe(500)
    expect(fitted.data.imageAspect).toBe(2)
  })

  it('clears imageAspect and width/height when the image is removed', () => {
    const fitted = applyNodeImage(baseNode(), 'data:image/png;base64,AAAA', 400, 200)
    const removed = applyNodeImage(fitted, undefined, undefined, undefined)
    expect(removed.data.image).toBeUndefined()
    expect(removed.data.imageAspect).toBeUndefined()
    expect(removed.width).toBeUndefined()
    expect(removed.height).toBeUndefined()
  })

  it('leaves other data fields untouched', () => {
    const node = baseNode({ data: { label: 'keep me', labelSize: 'large' } })
    const next = applyNodeImage(node, 'data:image/png;base64,AAAA', 400, 200)
    expect(next.data.label).toBe('keep me')
    expect(next.data.labelSize).toBe('large')
  })
})
