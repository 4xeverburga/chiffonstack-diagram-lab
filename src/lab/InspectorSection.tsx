import { useReducer, type ReactNode, type SyntheticEvent } from 'react'
import { isSectionOpen, setSectionOpen, type InspectorSectionId } from './inspectorSectionState'

type InspectorSectionProps = {
  id: InspectorSectionId
  title: string
  defaultOpen: boolean
  // Right-hand slot in the summary row — reserved for the config-presets
  // picker (next feature) on ROLE & CAPABILITY; pass null everywhere else.
  summaryExtra: ReactNode
  children: ReactNode
}

// One collapsible Inspector section. Native <details>/<summary> so the
// affordance, keyboard handling, and semantics come for free; open state
// is read from inspectorSectionState on every render (not useState) so
// untouched sections keep following their runStatus-aware default while
// user toggles stick across selection changes.
export function InspectorSection({ id, title, defaultOpen, summaryExtra, children }: InspectorSectionProps) {
  const [, rerender] = useReducer((tick: number) => tick + 1, 0)
  const open = isSectionOpen(id, defaultOpen)

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open
    // toggle also fires when React itself syncs the `open` prop (e.g. a
    // defaultOpen flip on runStatus change) — only record user toggles.
    if (next === open) return
    setSectionOpen(id, next)
    rerender()
  }

  return (
    <details className="lab-section" open={open} onToggle={handleToggle}>
      <summary className="lab-section-summary">
        <span className="lab-section-caret" aria-hidden="true" />
        <span className="lab-section-title">{title}</span>
        {summaryExtra}
      </summary>
      <div className="lab-section-body">{children}</div>
    </details>
  )
}
