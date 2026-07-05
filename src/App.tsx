import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
} from 'react'
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
import { useExportActions } from './lab/useExportActions'
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

const nodeTypes = { labelNode: LabelNode }
const edgeTypes = { heat: HeatEdge }

function LabEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selection, setSelection] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] })
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_DESIGN_TOKENS)

  // Heat edges color their gradient from the live primary token, so the
  // canvas preview always matches what every export target would produce.
  // Carried through each edge's `data` (rather than closing over it in
  // edgeTypes) so edgeTypes stays a stable reference and React Flow doesn't
  // remount edges on every color change.
  const renderedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, data: { ...edge.data, primaryColor: tokens.primaryColor } })),
    [edges, tokens.primaryColor],
  )

  // Exposed as CSS custom properties on the canvas wrapper so node/edge
  // styling in App.css can reference the live tokens directly.
  const canvasTokenStyle = {
    '--token-primary': tokens.primaryColor,
    '--token-secondary': tokens.secondaryColor,
    '--token-heading-font': tokens.headingFont,
    '--token-body-font': tokens.bodyFont,
  } as CSSProperties

  // Replaces the whole diagram (rather than merging) so an uploaded
  // diagram.json deterministically reproduces what was exported
  // (contracts/diagram-json.md round-trip guarantee). Clears the selection
  // too, since the previously selected node/edge id may no longer exist.
  const handleImportDiagram = useCallback(
    (importedNodes: Node[], importedEdges: Edge[]) => {
      setNodes(importedNodes)
      setEdges(importedEdges)
      setSelection({ nodes: [], edges: [] })
    },
    [setNodes, setEdges],
  )

  const {
    handleExportJson,
    handleExportSvg,
    handleExportComponent,
    handleDownloadBundle,
    handleUploadJson,
    jsonExportLabel,
    svgExportLabel,
    componentExportLabel,
    bundleExportLabel,
    uploadLabel,
  } = useExportActions(nodes, edges, tokens, handleImportDiagram)
  const canvasRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
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

  const handleClickUpload = useCallback(() => {
    uploadInputRef.current?.click()
  }, [])

  const handleUploadFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      handleUploadJson(file)
    },
    [handleUploadJson],
  )

  const handleSetNodeKind = useCallback(
    (id: string, kind: NodeKind) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, className: classNameForKind(kind) } : node)),
      )
    },
    [setNodes],
  )

  const handleSetNodeImage = useCallback(
    (id: string, image: string | undefined) => {
      setNodes((current) =>
        current.map((node) => (node.id === id ? { ...node, data: { ...node.data, image } } : node)),
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

  // Look up the live node/edge by id rather than using the objects from the
  // `onSelectionChange` event directly — React Flow doesn't re-fire that
  // event when a selected node/edge's own data changes, so holding onto the
  // event's objects would show the Inspector stale data (e.g. a label/image
  // edit wouldn't be reflected back into its own field).
  const selectedNodeId = selection.nodes[0]?.id
  const selectedEdgeId = selection.edges[0]?.id
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : undefined
  const selectedEdge = selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) : undefined

  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="lab-title">Diagram Lab</span>
        <span className="lab-meta">React Flow authoring tool for system topology diagrams</span>
        <button type="button" className="lab-export" onClick={handleExportSvg}>
          {svgExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleExportComponent}>
          {componentExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleDownloadBundle}>
          {bundleExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleExportJson}>
          {jsonExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleClickUpload}>
          {uploadLabel}
        </button>
        <input
          ref={uploadInputRef}
          type="file"
          accept="application/json"
          className="lab-upload-input"
          onChange={handleUploadFileChange}
        />
      </header>
      <div className="lab-body">
        <Sidebar onAddNode={handleAddFromSidebar} tokens={tokens} onChangeTokens={setTokens} />
        <div
          className="lab-canvas"
          ref={canvasRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          style={canvasTokenStyle}
        >
          <ReactFlow
            nodes={nodes}
            edges={renderedEdges}
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
          onSetNodeImage={handleSetNodeImage}
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
