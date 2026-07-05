import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import type { HeatVariant } from './heatVariants'
import { nextThickness, resolveDirection, resolveThickness, type EdgeThickness } from './edgeStyle'
import { computeImageFit, heightForRatioLockedWidth } from './imageFit'
import { labelBandFor, resolveTextSize, type TextSize } from './textSizes'
import type { SimRole } from '../engine/ports'

type SetNodes = Dispatch<SetStateAction<Node[]>>
type SetEdges = Dispatch<SetStateAction<Edge[]>>

function nodeLabelText(node: Node): string {
  return typeof node.data.label === 'string' ? node.data.label : ''
}

function nodeImageAspect(node: Node): number | undefined {
  return typeof node.data.imageAspect === 'number' && Number.isFinite(node.data.imageAspect) && node.data.imageAspect > 0
    ? node.data.imageAspect
    : undefined
}

// A label's text and size only ever affect the label band beneath the
// image, so an already image-fitted node (data.imageAspect set) can keep
// its width and just re-derive height whenever the label changes — via
// renameNode/setNodeLabelSize below. Without this, clearing a label (or
// picking a different labelSize) leaves the box sized for a label that no
// longer matches what's rendered. No-op for nodes that aren't image-fitted.
// Exported (like applyNodeImage) so this is unit-testable without mounting
// the hook.
export function refitLabelBand(node: Node): Node {
  const aspect = nodeImageAspect(node)
  if (aspect === undefined || typeof node.width !== 'number') return node
  const labelBand = labelBandFor(nodeLabelText(node), resolveTextSize(node.data.labelSize))
  return { ...node, height: Math.round(heightForRatioLockedWidth(node.width, aspect, labelBand)) }
}

// Pure per-node transform behind setNodeImage, extracted so the
// upload/replace/remove/re-fit lifecycle (spec 005, US1/US4) is unit-
// testable without mounting the hook. Setting an image with its natural
// dimensions (re)fits the node to that image's aspect ratio — manual-size
// semantics: persisted width/height, ratio locked via data.imageAspect,
// overriding any prior manual size (research.md R3/R5). Passing
// `image = undefined` clears the fit and returns the node to auto-sizing
// (FR-005).
export function applyNodeImage(
  node: Node,
  image: string | undefined,
  naturalWidth: number | undefined,
  naturalHeight: number | undefined,
): Node {
  if (image && naturalWidth && naturalHeight) {
    const labelBand = labelBandFor(nodeLabelText(node), resolveTextSize(node.data.labelSize))
    const fit = computeImageFit(naturalWidth, naturalHeight, labelBand)
    return {
      ...node,
      data: { ...node.data, image, imageAspect: fit.aspect },
      width: fit.width,
      height: fit.height,
    }
  }
  const nextData = { ...node.data, image } as Record<string, unknown>
  delete nextData.imageAspect
  const nextNode = { ...node, data: nextData }
  delete nextNode.width
  delete nextNode.height
  return nextNode
}

// Every node/edge mutation callback the editor UI (Inspector, EdgeToolbar)
// dispatches, extracted from App.tsx so it stays under the constitution's
// file-size cap and keeps to wiring (plan.md Complexity Tracking). All
// updates spread the previous `data` so orthogonal fields survive each
// other's edits (e.g. changing a variant keeps thickness/direction — the
// stored direction must reapply if an edge turns animated again,
// research.md R6).
export function useDiagramMutations(setNodes: SetNodes, setEdges: SetEdges) {
  const renameNode = useCallback(
    (id: string, label: string) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? refitLabelBand({ ...node, data: { ...node.data, label } }) : node)),
      )
    },
    [setNodes],
  )

  const setNodeKind = useCallback(
    (id: string, kind: NodeKind) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, className: classNameForKind(kind) } : node)),
      )
    },
    [setNodes],
  )

  const setNodeImage = useCallback(
    (id: string, image: string | undefined, naturalWidth: number | undefined, naturalHeight: number | undefined) => {
      setNodes((current) => current.map((node) => (node.id === id ? applyNodeImage(node, image, naturalWidth, naturalHeight) : node)))
    },
    [setNodes],
  )

  const setNodeLabelSize = useCallback(
    (id: string, labelSize: TextSize) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? refitLabelBand({ ...node, data: { ...node.data, labelSize } }) : node)),
      )
    },
    [setNodes],
  )

  const setEdgeVariant = useCallback(
    (id: string, variant: HeatVariant) => {
      setEdges((current) =>
        current.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, variant } } : edge)),
      )
    },
    [setEdges],
  )

  const setEdgeThickness = useCallback(
    (id: string, thickness: EdgeThickness) => {
      setEdges((current) =>
        current.map((edge) => (edge.id === id ? { ...edge, data: { ...edge.data, thickness } } : edge)),
      )
    },
    [setEdges],
  )

  const cycleEdgeThickness = useCallback(
    (id: string) => {
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? { ...edge, data: { ...edge.data, thickness: nextThickness(resolveThickness(edge.data?.thickness)) } }
            : edge,
        ),
      )
    },
    [setEdges],
  )

  // Flips animation playback only — source/target/sourceHandle/targetHandle
  // are untouched, so attachments and arrow semantics never change (FR-004).
  const reverseEdgeDirection = useCallback(
    (id: string) => {
      setEdges((current) =>
        current.map((edge) =>
          edge.id === id
            ? {
                ...edge,
                data: {
                  ...edge.data,
                  direction: resolveDirection(edge.data?.direction) === 'reverse' ? 'forward' : 'reverse',
                },
              }
            : edge,
        ),
      )
    },
    [setEdges],
  )

  const deleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id))
    },
    [setEdges],
  )

  // Sets or clears a node's simulation role (FR-001). `undefined` returns
  // the node to a plain diagram node (no `sim` key at all — kept out of
  // `data` entirely rather than left as `sim: undefined`, so exportDiagram's
  // whitelist and legacy-diagram comparisons see exactly the pre-pivot
  // shape for nodes nobody has assigned a role to).
  const setNodeSimRole = useCallback(
    (id: string, sim: SimRole | undefined) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== id) return node
          const nextData = { ...node.data } as Record<string, unknown>
          if (sim) nextData.sim = sim
          else delete nextData.sim
          return { ...node, data: nextData }
        }),
      )
    },
    [setNodes],
  )

  return useMemo(
    () => ({
      renameNode,
      setNodeKind,
      setNodeImage,
      setNodeLabelSize,
      setEdgeVariant,
      setEdgeThickness,
      cycleEdgeThickness,
      reverseEdgeDirection,
      deleteEdge,
      setNodeSimRole,
    }),
    [
      renameNode,
      setNodeKind,
      setNodeImage,
      setNodeLabelSize,
      setEdgeVariant,
      setEdgeThickness,
      cycleEdgeThickness,
      reverseEdgeDirection,
      deleteEdge,
      setNodeSimRole,
    ],
  )
}
