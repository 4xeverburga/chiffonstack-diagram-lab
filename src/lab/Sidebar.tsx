import type { DragEvent } from 'react'
import { classNameForKind, type NodeKind } from './nodeKinds'

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
}

// Langflow-style "add node" palette: drag a kind onto the canvas, or click to
// drop it at the canvas center.
export function Sidebar({ onAddNode }: SidebarProps) {
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
    </aside>
  )
}
