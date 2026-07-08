// Session-scoped open/collapsed state for the Inspector's accordion
// sections. Lives outside React because the Inspector remounts on every
// selection change (its `key` is the node/edge id) — a plain useState
// would forget the user's toggles each time they click another node.
//
// Defaults are runStatus-aware (idle opens config, running opens
// telemetry/formulas), so "no stored value" is meaningful: a section only
// stops following its default once the user toggles it by hand.
export type InspectorSectionId =
  | 'node-role-capability'
  | 'node-scaling'
  | 'node-telemetry'
  | 'node-formulas'
  | 'node-appearance'
  | 'edge-style'
  | 'edge-traffic'
  | 'edge-telemetry'
  | 'edge-formulas'

const sectionOpenState = new Map<InspectorSectionId, boolean>()

export function isSectionOpen(id: InspectorSectionId, defaultOpen: boolean): boolean {
  const stored = sectionOpenState.get(id)
  return stored === undefined ? defaultOpen : stored
}

export function setSectionOpen(id: InspectorSectionId, open: boolean): void {
  sectionOpenState.set(id, open)
}

export function resetSectionOpenState(): void {
  sectionOpenState.clear()
}
