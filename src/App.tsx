import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'

// Starter topology matching the ChiffonStack teardown diagram language
// (see DESIGN.md §4 Case-Study Teardown / §7 Isotype & Logo).
// Author your layout here, then export/trace it into a static SVG for the
// real component — these diagrams ship as imagery, not a live interactive
// widget, per the project's zero-JS baseline.
const initialNodes: Node[] = [
  { id: 'user', position: { x: 0, y: 80 }, data: { label: 'user' }, className: 'node' },
  { id: 'router', position: { x: 220, y: 80 }, data: { label: 'router' }, className: 'node node-active' },
  { id: 'tool', position: { x: 460, y: 0 }, data: { label: 'tool' }, className: 'node' },
  { id: 'fallback', position: { x: 460, y: 160 }, data: { label: 'fallback' }, className: 'node node-dim' },
]

const initialEdges: Edge[] = [
  { id: 'user-router', source: 'user', target: 'router', className: 'edge-hot', animated: true },
  { id: 'router-tool', source: 'router', target: 'tool', className: 'edge-hot' },
  { id: 'router-fallback', source: 'router', target: 'fallback', className: 'edge-dashed' },
]

function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  )

  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="wordmark">Chiffon<span>Stack</span></span>
        <span className="lab-meta">diagram lab · React Flow authoring tool · not shipped to the site</span>
      </header>
      <div className="lab-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background gap={24} size={1} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  )
}

export default App
