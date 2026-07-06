import type { FormulaDescriptor, SimRole } from '../engine/ports'

// Pure view-model logic for FormulaPanel.tsx, split into its own module so
// that file only exports the component (oxlint's react/only-export-
// components fast-refresh rule) and so this pure logic is independently
// unit-testable (constitution Principle VI's pure-logic testing split).
export const FORMULA_PANEL_DISCLAIMER =
  'Simulated numbers are directionally correct for comparing scenarios, not guarantees of real-world performance.'

export interface FormulaPanelState {
  hasFormulas: boolean
  emptyMessage: string
}

export function describeFormulaPanelState(
  formulaDescriptors: FormulaDescriptor[] | undefined,
  simRole: SimRole | undefined,
): FormulaPanelState {
  if (formulaDescriptors && formulaDescriptors.length > 0) {
    return { hasFormulas: true, emptyMessage: '' }
  }
  if (simRole?.role === 'processor') {
    return {
      hasFormulas: false,
      emptyMessage: 'Placeholder (fixed rate) — no real technology model behind this node yet, so there are no formulas to show.',
    }
  }
  return {
    hasFormulas: false,
    emptyMessage: 'No formulas apply to this node yet — assign a modeled role (e.g. Kafka) to see its active formulas here.',
  }
}
