import {
  useCallback,
  useMemo,
  useRef,
  useState,
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
import { Sidebar, DRAG_MIME_TYPE } from './lab/Sidebar'
import { ExportBar } from './lab/ExportBar'
import { Inspector } from './lab/Inspector'
import { classNameForKind, type NodeKind } from './lab/nodeKinds'
import { initialEdges, initialNodes } from './lab/initialDiagram'
import { useDiagramMutations } from './lab/useDiagramMutations'
import { useExportActions } from './lab/useExportActions'
import { useHandleVisibility, withHandlesVisibleClass } from './lab/useHandleVisibility'
import { DEFAULT_DESIGN_TOKENS, type DesignTokens } from './lab/designTokens'

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

  const mutations = useDiagramMutations(setNodes, setEdges)

  // Heat edges color their gradient from the live primary token, so the
  // canvas preview always matches what every export target would produce.
  // Carried through each edge's `data` (rather than closing over it in
  // edgeTypes) so edgeTypes stays a stable reference and React Flow doesn't
  // remount edges on every color change. The EdgeToolbar callbacks ride the
  // same channel (research.md R4); exportDiagram.ts whitelists edge data,
  // so none of these runtime fields can reach the canonical JSON.
  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          primaryColor: tokens.primaryColor,
          onCycleThickness: mutations.cycleEdgeThickness,
          onReverseDirection: mutations.reverseEdgeDirection,
        },
      })),
    [edges, tokens.primaryColor, mutations.cycleEdgeThickness, mutations.reverseEdgeDirection],
  )

  // Nodes touched by the current selection (a selected node itself, or
  // either endpoint of a selected edge) get a "handles-visible" class so
  // their otherwise-hidden connection points show while the selection lasts
  // (US2, FR-002). Hover and in-progress connection drags are handled by
  // App.css alone. See withHandlesVisibleClass for why this must be
  // idempotent rather than a blind append.
  const handlesVisibleNodeIds = useHandleVisibility(selection)
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const className = withHandlesVisibleClass(node.className, handlesVisibleNodeIds.has(node.id))
        return className === (node.className ?? '') ? node : { ...node, className }
      }),
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

  const exportActions = useExportActions(nodes, edges, tokens, handleImportDiagram)
  const canvasRef = useRef<HTMLDivElement>(null)
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
      <ExportBar actions={exportActions} />
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
          onRenameNode={mutations.renameNode}
          onSetNodeKind={mutations.setNodeKind}
          onSetNodeImage={mutations.setNodeImage}
          onSetNodeLabelSize={mutations.setNodeLabelSize}
          onSetEdgeVariant={mutations.setEdgeVariant}
          onSetEdgeThickness={mutations.setEdgeThickness}
          onReverseEdgeDirection={mutations.reverseEdgeDirection}
          onDeleteEdge={mutations.deleteEdge}
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
