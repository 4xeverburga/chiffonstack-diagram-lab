import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { applyNodeImage, refitLabelBand } from '../../src/lab/useDiagramMutations'

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

  it('fits a node with no label to the image alone, with no label-band gap reserved', () => {
    const labeled = applyNodeImage(baseNode({ data: { label: 'caption' } }), 'data:image/png;base64,AAAA', 400, 200)
    const blank = applyNodeImage(baseNode({ data: { label: '' } }), 'data:image/png;base64,AAAA', 400, 200)
    // Same image, same fitted width, but the blank-label node should be
    // shorter — no label band added underneath the image.
    expect(blank.width).toBe(labeled.width)
    expect(blank.height).toBeLessThan(labeled.height as number)
  })

  it('treats a whitespace-only label the same as a blank one (no label-band gap)', () => {
    const blank = applyNodeImage(baseNode({ data: { label: '' } }), 'data:image/png;base64,AAAA', 400, 200)
    const whitespace = applyNodeImage(baseNode({ data: { label: '   ' } }), 'data:image/png;base64,AAAA', 400, 200)
    expect(whitespace.height).toBe(blank.height)
  })
})

describe('refitLabelBand', () => {
  it('shrinks an image-fitted node when its label is cleared', () => {
    const fitted = applyNodeImage(baseNode({ data: { label: 'caption' } }), 'data:image/png;base64,AAAA', 400, 200)
    const cleared = refitLabelBand({ ...fitted, data: { ...fitted.data, label: '' } })
    expect(cleared.width).toBe(fitted.width)
    expect(cleared.height).toBeLessThan(fitted.height as number)
  })

  it('grows an image-fitted node back when a label is typed in', () => {
    const fitted = applyNodeImage(baseNode({ data: { label: '' } }), 'data:image/png;base64,AAAA', 400, 200)
    const labeled = refitLabelBand({ ...fitted, data: { ...fitted.data, label: 'caption' } })
    expect(labeled.height).toBeGreaterThan(fitted.height as number)
  })

  it('re-derives height when labelSize changes on an image-fitted node', () => {
    const fitted = applyNodeImage(baseNode({ data: { label: 'caption', labelSize: 'normal' } }), 'data:image/png;base64,AAAA', 400, 200)
    const larger = refitLabelBand({ ...fitted, data: { ...fitted.data, labelSize: 'large' } })
    expect(larger.height).toBeGreaterThan(fitted.height as number)
  })

  it('is a no-op for nodes that are not image-fitted', () => {
    const plain = baseNode({ width: 120, height: 60 })
    expect(refitLabelBand(plain)).toEqual(plain)
  })
})
