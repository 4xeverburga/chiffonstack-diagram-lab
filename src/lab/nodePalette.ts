import type { NodeSim } from '../engine/ports'

// Fase 5 (plan.md "Inspector denso y estado-consciente"): paleta reducida a
// 2 roles semánticos. Active/Dim ya no viven aquí — son estética pura
// (Style chips en el Inspector, decisión #4 del plan). Extracted from
// Sidebar.tsx (which only exports the component) so fast refresh stays
// happy — same pattern as formulaPanelState.ts/FormulaPanel.tsx.
export type PaletteKey = 'node' | 'queue'

export type PaletteItem = {
  key: PaletteKey
  label: string
  hint: string
  sim: NodeSim | undefined
}

export const PALETTE: PaletteItem[] = [
  { key: 'node', label: 'Node', hint: 'Neutral node — assign a Simulation role in the Inspector', sim: undefined },
  { key: 'queue', label: 'Queue', hint: 'Zero-config queue node', sim: { kind: 'queue' } },
]

export const DRAG_MIME_TYPE = 'application/chiffon-node'

// Shared lookup so App.tsx's onDrop can resolve the sim role carried by
// the drag payload (a plain PaletteKey string, the only thing the native
// HTML5 DnD dataTransfer can reliably transport) from the same source of
// truth as Sidebar's click handler.
export function simForPaletteKey(key: string): NodeSim | undefined {
  return PALETTE.find((item) => item.key === key)?.sim
}
