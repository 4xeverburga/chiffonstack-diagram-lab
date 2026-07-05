import { Position } from '@xyflow/react'

// Shared vocabulary for the four connection points every node exposes (top,
// bottom, left, right). Used as the React Flow handle id on LabelNode.tsx,
// as the serialized sourceHandle/targetHandle value in the canonical JSON,
// and as the key into the anchor math shared by every export target — one
// vocabulary, no mapping layer (specs/002-node-connection-handles/data-model.md).
export type HandleSide = 'top' | 'bottom' | 'left' | 'right'

export const HANDLE_SIDES: HandleSide[] = ['top', 'bottom', 'left', 'right']

export function isHandleSide(value: unknown): value is HandleSide {
  return typeof value === 'string' && HANDLE_SIDES.includes(value as HandleSide)
}

// Byte-for-byte the current behavior: today's LabelNode renders its target
// handle at Position.Left and its source handle at Position.Right, and
// exportGeometry.ts hardcodes the same pair. Imported pre-feature diagrams
// (which carry no sourceHandle/targetHandle) must resolve to exactly these
// sides so they look identical to how they were saved (FR-007, research.md R3).
export const LEGACY_SOURCE_SIDE: HandleSide = 'right'
export const LEGACY_TARGET_SIDE: HandleSide = 'left'

// Falls back to `fallback` rather than throwing on a missing/unrecognized
// value, so a hand-edited JSON file with a bad side never fails the import
// (FR-008) — mirrors parsePlainEdge's existing variant-fallback pattern.
export function resolveHandleSide(value: unknown, fallback: HandleSide): HandleSide {
  return isHandleSide(value) ? value : fallback
}

export const HANDLE_SIDE_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
}

// Structurally compatible with exportGeometry.ts's NodeBox — kept as a local
// shape here (rather than importing NodeBox) so this module has no
// dependency on exportGeometry.ts and stays the single, dependency-free
// source of side vocabulary that every other module imports from.
export type SideAnchorBox = {
  x: number
  y: number
  width: number
  height: number
}

// The point on a node's rendered box where a given side's handle sits —
// shared by the canvas (implicitly, via React Flow's own Handle positioning)
// and every geometry-based export target (SVG, component-code paths) so
// side anchoring can't drift between them (FR-009).
export function anchorPointForSide(box: SideAnchorBox, side: HandleSide): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: box.x + box.width / 2, y: box.y }
    case 'bottom':
      return { x: box.x + box.width / 2, y: box.y + box.height }
    case 'left':
      return { x: box.x, y: box.y + box.height / 2 }
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height / 2 }
  }
}
