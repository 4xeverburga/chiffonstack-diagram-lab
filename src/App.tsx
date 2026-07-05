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
  ConnectionMode,
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
import { useHandleVisibility } from './lab/useHandleVisibility'
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
  {
    id: 'user-router',
    source: 'user',
    target: 'router',
    type: 'heat',
    data: { variant: 'heat-flow' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-tool',
    source: 'router',
    target: 'tool',
    type: 'heat',
    data: { variant: 'heat-static' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'router-fallback',
    source: 'router',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'dashed' },
    sourceHandle: 'right',
    targetHandle: 'left',
  },
  {
    id: 'tool-fallback',
    source: 'tool',
    target: 'fallback',
    type: 'heat',
    data: { variant: 'default' },
    sourceHandle: 'bottom',
    targetHandle: 'top',
  },
]

const nodeTypes = { labelNode: LabelNode }
const edgeTypes = { heat: HeatEdge }

function LabEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selection, setSelection] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] })
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_DESIGN_TOKENS)
  // True while the user is actively dragging a new connection from a handle —
  // toggled by onConnectStart/onConnectEnd below and read by App.css to reveal
  // every node's handles for the duration of the drag (US2, research.md R4).
  const [connecting, setConnecting] = useState(false)

  // Heat edges color their gradient from the live primary token, so the
  // canvas preview always matches what every export target would produce.
  // Carried through each edge's `data` (rather than closing over it in
  // edgeTypes) so edgeTypes stays a stable reference and React Flow doesn't
  // remount edges on every color change.
  const renderedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, data: { ...edge.data, primaryColor: tokens.primaryColor } })),
    [edges, tokens.primaryColor],
  )

  // Nodes touched by the current selection (a selected node itself, or
  // either endpoint of a selected edge) get a "handles-visible" class so
  // their otherwise-hidden connection points show while the selection lasts
  // (US2, FR-002). Hover and in-progress connection drags are handled by
  // App.css alone.
  const handlesVisibleNodeIds = useHandleVisibility(selection)
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) =>
        handlesVisibleNodeIds.has(node.id)
          ? { ...node, className: `${node.className ?? ''} handles-visible`.trim() }
          : node,
      ),
    [nodes, handlesVisibleNodeIds],
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

  // `connection` already carries the dragged handle ids as sourceHandle/
  // targetHandle (React Flow reports the handle the drag started/ended on);
  // spreading it straight onto the new edge is what makes those ids the
  // edge's canonical attachment (FR-003) — nothing here needs to read or
  // rename them.
  //
  // A freshly-drawn edge is also selected (deselecting whatever nodes/edges
  // came before it), so the Inspector immediately shows its style controls
  // instead of leaving the panel on its empty "select a node or edge" state.
  const onConnect = useCallback(
    (connection: Connection) => {
      const previousIds = new Set(edges.map((edge) => edge.id))
      const nextEdges = addEdge({ ...connection, type: 'heat', data: { variant: 'default' } }, edges)
      const newEdge = nextEdges.find((edge) => !previousIds.has(edge.id))
      if (!newEdge) {
        setEdges(nextEdges)
        return
      }
      setEdges(nextEdges.map((edge) => ({ ...edge, selected: edge.id === newEdge.id })))
      setNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)))
      setSelection({ nodes: [], edges: [newEdge] })
    },
    [edges, setEdges, setNodes],
  )

  // Loose mode plus this guard is what lets every one of a node's four
  // handles both originate and receive a connection (FR-001, research.md
  // R1) while still rejecting a node connecting to itself (research.md R6).
  const isValidConnection = useCallback((connection: Connection | Edge) => connection.source !== connection.target, [])

  const handleConnectStart = useCallback(() => setConnecting(true), [])
  const handleConnectEnd = useCallback(() => setConnecting(false), [])

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
          className={`lab-canvas${connecting ? ' connecting' : ''}`}
          ref={canvasRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          style={canvasTokenStyle}
        >
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            isValidConnection={isValidConnection}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
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
