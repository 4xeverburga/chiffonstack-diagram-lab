import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { LabelNode } from './lab/LabelNode'
import { HeatEdge } from './lab/HeatEdge'
import type { HeatVariant } from './lab/heatVariants'
import { Sidebar, DRAG_MIME_TYPE } from './lab/Sidebar'
import { Inspector } from './lab/Inspector'
import { classNameForKind, type NodeKind } from './lab/nodeKinds'
import { copyDiagramToClipboard } from './lab/exportDiagram'
import { copyDiagramCodeToClipboard } from './lab/exportCode'
import { DEFAULT_DESIGN_TOKENS, type DesignTokens } from './lab/designTokens'

// Starter topology matching the ChiffonStack teardown diagram language
// (see DESIGN.md §4 Case-Study Teardown / §7 Isotype & Logo).
// Author your layout here — drag new nodes in from the sidebar, wire them up,
// then Export JSON and trace the result into a static SVG for the real
// component; these diagrams ship as imagery, not a live interactive widget,
// per the project's zero-JS baseline.
const initialNodes: Node[] = [
  { id: 'user', type: 'labelNode', position: { x: 0, y: 80 }, data: { label: 'user' }, className: 'node' },
  { id: 'router', type: 'labelNode', position: { x: 220, y: 80 }, data: { label: 'router' }, className: 'node node-active' },
  { id: 'tool', type: 'labelNode', position: { x: 460, y: 0 }, data: { label: 'tool' }, className: 'node' },
  { id: 'fallback', type: 'labelNode', position: { x: 460, y: 160 }, data: { label: 'fallback' }, className: 'node node-dim' },
]

const initialEdges: Edge[] = [
  { id: 'user-router', source: 'user', target: 'router', type: 'heat', data: { variant: 'heat-flow' } },
  { id: 'router-tool', source: 'router', target: 'tool', type: 'heat', data: { variant: 'heat-static' } },
  { id: 'router-fallback', source: 'router', target: 'fallback', type: 'heat', data: { variant: 'dashed' } },
]

const edgeTypes = { heat: HeatEdge }
const nodeTypes = { labelNode: LabelNode }

function LabEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selection, setSelection] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] })
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_DESIGN_TOKENS)
  const [jsonExportStatus, setJsonExportStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [codeExportStatus, setCodeExportStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const canvasRef = useRef<HTMLDivElement>(null)
  const idCounter = useRef(0)
  const { screenToFlowPosition } = useReactFlow()

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'heat', data: { variant: 'default' } }, eds)),
    [setEdges],
  )

  const handleRenameNode = useCallback(
    (id: string, label: string) => {
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)))
    },
    [setNodes],
  )

  const addNode = useCallback(
    (kind: NodeKind, position: XYPosition) => {
      idCounter.current += 1
      const id = `node-${Date.now()}-${idCounter.current}`
      const newNode: Node = {
        id,
        type: 'labelNode',
        position,
        data: { label: 'New node' },
        className: classNameForKind(kind),
      }
      setNodes((current) => [...current, newNode])
    },
    [setNodes],
  )

  const handleAddFromSidebar = useCallback(
    (kind: NodeKind) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      const point = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      addNode(kind, screenToFlowPosition(point))
    },
    [addNode, screenToFlowPosition],
  )

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(DRAG_MIME_TYPE) as NodeKind | ''
      if (!kind) return
      addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    },
    [addNode, screenToFlowPosition],
  )

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const handleSetNodeKind = useCallback(
    (id: string, kind: NodeKind) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, className: classNameForKind(kind) } : node)),
      )
    },
    [setNodes],
  )

  const handleSetEdgeVariant = useCallback(
    (id: string, variant: HeatVariant) => {
      setEdges((current) => current.map((edge) => (edge.id === id ? { ...edge, data: { variant } } : edge)))
    },
    [setEdges],
  )

  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((current) => current.filter((edge) => edge.id !== id))
    },
    [setEdges],
  )

  const handleExportJson = useCallback(() => {
    copyDiagramToClipboard(nodes, edges)
      .then(() => setJsonExportStatus('copied'))
      .catch((error: unknown) => {
        console.error('Failed to copy diagram JSON', error)
        setJsonExportStatus('error')
      })
  }, [nodes, edges])

  const handleExportCode = useCallback(() => {
    copyDiagramCodeToClipboard(nodes, edges, tokens)
      .then(() => setCodeExportStatus('copied'))
      .catch((error: unknown) => {
        console.error('Failed to copy diagram code', error)
        setCodeExportStatus('error')
      })
  }, [nodes, edges, tokens])

  useEffect(() => {
    if (jsonExportStatus === 'idle') return
    const timer = setTimeout(() => setJsonExportStatus('idle'), 1800)
    return () => clearTimeout(timer)
  }, [jsonExportStatus])

  useEffect(() => {
    if (codeExportStatus === 'idle') return
    const timer = setTimeout(() => setCodeExportStatus('idle'), 1800)
    return () => clearTimeout(timer)
  }, [codeExportStatus])

  const selectedNode = selection.nodes[0]
  const selectedEdge = selection.edges[0]

  const jsonExportLabel =
    jsonExportStatus === 'copied' ? 'Copied!' : jsonExportStatus === 'error' ? 'Copy failed' : 'Export JSON'
  const codeExportLabel =
    codeExportStatus === 'copied' ? 'Copied!' : codeExportStatus === 'error' ? 'Copy failed' : 'Export code'

  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="lab-title">Diagram Lab</span>
        <span className="lab-meta">React Flow authoring tool for system topology diagrams</span>
        <button type="button" className="lab-export" onClick={handleExportCode}>
          {codeExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleExportJson}>
          {jsonExportLabel}
        </button>
      </header>
      <div className="lab-body">
        <Sidebar onAddNode={handleAddFromSidebar} tokens={tokens} onChangeTokens={setTokens} />
        <div className="lab-canvas" ref={canvasRef} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={setSelection}
            fitView
          >
            <Background gap={24} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <Inspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onRenameNode={handleRenameNode}
          onSetNodeKind={handleSetNodeKind}
          onSetEdgeVariant={handleSetEdgeVariant}
          onDeleteEdge={handleDeleteEdge}
        />
      </div>
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <LabEditor />
    </ReactFlowProvider>
  )
}

export default App
