import type { DragEvent } from 'react'
import { classNameForKind, type NodeKind } from './nodeKinds'
import type { DesignTokens } from './designTokens'

type PaletteItem = {
  kind: NodeKind
  label: string
  hint: string
}

const PALETTE: PaletteItem[] = [
  { kind: 'default', label: 'Node', hint: 'Neutral system node' },
  { kind: 'active', label: 'Active node', hint: 'Heat-highlighted, the live path' },
  { kind: 'dim', label: 'Dim node', hint: 'Faded, fallback / secondary path' },
]

export const DRAG_MIME_TYPE = 'application/chiffon-node'

type SidebarProps = {
  onAddNode: (kind: NodeKind) => void
  tokens: DesignTokens
  onChangeTokens: (tokens: DesignTokens) => void
}

// Langflow-style "add node" palette: drag a kind onto the canvas, or click to
// drop it at the canvas center. Also hosts the design-token inputs (brand
// colors/fonts), which restyle the live canvas immediately and feed the
// "Export code" output.
export function Sidebar({ onAddNode, tokens, onChangeTokens }: SidebarProps) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: NodeKind) => {
    event.dataTransfer.setData(DRAG_MIME_TYPE, kind)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="lab-sidebar">
      <h2 className="lab-panel-title">Add node</h2>
      <ul className="lab-palette">
        {PALETTE.map((item) => (
          <li key={item.kind}>
            <button
              type="button"
              className="palette-item"
              draggable
              onDragStart={(event) => onDragStart(event, item.kind)}
              onClick={() => onAddNode(item.kind)}
            >
              <span className={`palette-swatch ${classNameForKind(item.kind)}`} />
              <span className="palette-copy">
                <span className="palette-label">{item.label}</span>
                <span className="palette-hint">{item.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="lab-sidebar-note">Drag onto the canvas, or click to drop at center.</p>

      <h2 className="lab-panel-title lab-panel-title-spaced">Design tokens</h2>
      <label className="lab-field">
        <span>Primary color</span>
        <div className="lab-color-field">
          <input
            type="color"
            value={tokens.primaryColor}
            onChange={(event) => onChangeTokens({ ...tokens, primaryColor: event.target.value })}
          />
          <input
            value={tokens.primaryColor}
            onChange={(event) => onChangeTokens({ ...tokens, primaryColor: event.target.value })}
          />
        </div>
      </label>
      <label className="lab-field">
        <span>Secondary color</span>
        <div className="lab-color-field">
          <input
            type="color"
            value={tokens.secondaryColor}
            onChange={(event) => onChangeTokens({ ...tokens, secondaryColor: event.target.value })}
          />
          <input
            value={tokens.secondaryColor}
            onChange={(event) => onChangeTokens({ ...tokens, secondaryColor: event.target.value })}
          />
        </div>
      </label>
      <label className="lab-field">
        <span>Heading font</span>
        <input
          value={tokens.headingFont}
          onChange={(event) => onChangeTokens({ ...tokens, headingFont: event.target.value })}
          placeholder="e.g. Quicksand, sans-serif"
        />
      </label>
      <label className="lab-field">
        <span>Body font</span>
        <input
          value={tokens.bodyFont}
          onChange={(event) => onChangeTokens({ ...tokens, bodyFont: event.target.value })}
          placeholder="e.g. Hanken Grotesk, sans-serif"
        />
      </label>
      <p className="lab-sidebar-note">Updates the canvas live and styles the "Export code" output.</p>
    </aside>
  )
}

