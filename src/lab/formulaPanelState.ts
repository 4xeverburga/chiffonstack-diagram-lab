import type { FormulaDescriptor, NodeSim } from '../engine/ports'

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
  sim: NodeSim | undefined,
): FormulaPanelState {
  if (formulaDescriptors && formulaDescriptors.length > 0) {
    return { hasFormulas: true, emptyMessage: '' }
  }
  if (sim?.kind === 'queue') {
    return {
      hasFormulas: false,
      emptyMessage: 'No formulas apply to this node yet — queue backlog formulas appear once the simulation is running.',
    }
  }
  return {
    hasFormulas: false,
    emptyMessage: 'No formulas apply to this node yet — assign a host or queue role, then start the simulation to see its active formulas here.',
  }
}
