import type { HeatVariant } from './heatVariants'

// Closed styling vocabulary for edges (specs/003-edge-styling-controls/
// data-model.md): a three-step thickness and a binary animation direction,
// stored in edge.data beside `variant` and serialized into the canonical
// JSON. Per the constitution's variant rule there is deliberately no
// numeric thickness anywhere — these steps are the entire vocabulary.
export type EdgeThickness = 'thin' | 'normal' | 'thick'

export const EDGE_THICKNESSES: EdgeThickness[] = ['thin', 'normal', 'thick']

export type EdgeDirection = 'forward' | 'reverse'

export const EDGE_DIRECTIONS: EdgeDirection[] = ['forward', 'reverse']

export const DEFAULT_THICKNESS: EdgeThickness = 'normal'
export const DEFAULT_DIRECTION: EdgeDirection = 'forward'

// Stroke width overrides for the non-default steps, keyed by the class each
// renderer emits. `normal` is intentionally absent: it renders each
// variant's pre-003 baseline width (heat variants' 2.5, default/dashed's
// hairline), so every legacy diagram keeps rendering byte-identically —
// only the opt-in thin/thick steps override (Constitution I: no silent
// visual drift on import).
export const THICKNESS_STROKE_WIDTH: Record<Exclude<EdgeThickness, 'normal'>, number> = {
  thin: 1.5,
  thick: 4,
}

export function resolveThickness(value: unknown): EdgeThickness {
  return EDGE_THICKNESSES.includes(value as EdgeThickness) ? (value as EdgeThickness) : DEFAULT_THICKNESS
}

export function resolveDirection(value: unknown): EdgeDirection {
  return EDGE_DIRECTIONS.includes(value as EdgeDirection) ? (value as EdgeDirection) : DEFAULT_DIRECTION
}

// Quick-action cycle order: thin → normal → thick → thin (spec US1).
export function nextThickness(current: EdgeThickness): EdgeThickness {
  const index = EDGE_THICKNESSES.indexOf(current)
  return EDGE_THICKNESSES[(index + 1) % EDGE_THICKNESSES.length]
}

// Single class-name builder shared by the canvas (prefix "lab-edge") and
// both visual exports (prefix "edge"), so the emitted class set can never
// drift between targets (data-model.md "Rendering contract"). The reverse
// class is emitted for any variant — it only has an effect where an
// animation exists, and keeping it unconditional lets a stored direction
// reapply when a variant turns animated again (research.md R6).
export function edgeStyleClassNames(
  variant: HeatVariant,
  thickness: EdgeThickness,
  direction: EdgeDirection,
  prefix: string,
): string {
  const classes = [prefix, `${prefix}-${variant}`, `${prefix}-w-${thickness}`]
  if (direction === 'reverse') classes.push(`${prefix}-reverse`)
  return classes.join(' ')
}
