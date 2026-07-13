import type { DragEvent } from 'react'
import { classNameForKind } from './nodeKinds'
import type { DesignTokens } from './designTokens'
import type { NodeSim } from 'sugar-skills'
import { DRAG_MIME_TYPE, PALETTE, type PaletteKey } from './nodePalette'

type SidebarProps = {
  onAddNode: (sim: NodeSim | undefined) => void
  tokens: DesignTokens
  onChangeTokens: (tokens: DesignTokens) => void
}

// Langflow-style "add node" palette: drag a role onto the canvas, or click to
// drop it at the canvas center. Also hosts the design-token inputs (brand
// colors/fonts), which restyle the live canvas immediately and feed every
// export target.
export function Sidebar({ onAddNode, tokens, onChangeTokens }: SidebarProps) {
  const onDragStart = (event: DragEvent<HTMLButtonElement>, key: PaletteKey) => {
    event.dataTransfer.setData(DRAG_MIME_TYPE, key)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <aside className="lab-sidebar">
      <h2 className="lab-panel-title">Add node</h2>
      <ul className="lab-palette">
        {PALETTE.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className="palette-item"
              draggable
              onDragStart={(event) => onDragStart(event, item.key)}
              onClick={() => onAddNode(item.sim)}
            >
              <span className={`palette-swatch ${classNameForKind('default')}`} />
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
      <div className="lab-field-grid">
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
      </div>
      <p className="lab-sidebar-note">Updates the canvas live and styles every export.</p>
    </aside>
  )
}


