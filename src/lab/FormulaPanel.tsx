import type { FormulaDescriptor, NodeSim } from '../engine/ports'
import { FORMULA_PANEL_DISCLAIMER, describeFormulaPanelState } from './formulaPanelState'

// Formula & sources panel (US4, FR-008/FR-009): renders every active
// FormulaDescriptor for the selected node — name, expression, current
// inputs, binding highlight, and source links — plus the standing
// directional-accuracy disclaimer (constitution Principle II wording
// rule). Empty-state copy logic lives in formulaPanelState.ts so this file
// only exports the component (oxlint fast-refresh rule) and that logic is
// unit testable without rendering JSX.
type FormulaPanelProps = {
  formulaDescriptors: FormulaDescriptor[] | undefined
  sim: NodeSim | undefined
}

export function FormulaPanel({ formulaDescriptors, sim }: FormulaPanelProps) {
  const { hasFormulas, emptyMessage } = describeFormulaPanelState(formulaDescriptors, sim)

  return (
    <div className="lab-formula-panel">
      <h3 className="lab-panel-title">Formulas &amp; sources</h3>
      {hasFormulas ? (
        <ul className="lab-formula-list">
          {formulaDescriptors!.map((descriptor) => (
            <li key={descriptor.id} className={`lab-formula ${descriptor.isBinding ? 'lab-formula-binding' : ''}`}>
              <div className="lab-formula-name">
                {descriptor.name}
                {descriptor.isBinding ? ' (binding)' : ''}
              </div>
              <div className="lab-formula-expression">{descriptor.expression}</div>
              <ul className="lab-formula-inputs">
                {Object.entries(descriptor.inputs).map(([key, value]) => (
                  <li key={key}>
                    {key}: {String(value)}
                  </li>
                ))}
              </ul>
              <div className="lab-formula-sources">
                {descriptor.sources.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" title={source.note}>
                    {source.title}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sim-placeholder-note">{emptyMessage}</p>
      )}
      <p className="lab-formula-disclaimer">{FORMULA_PANEL_DISCLAIMER}</p>
    </div>
  )
}
