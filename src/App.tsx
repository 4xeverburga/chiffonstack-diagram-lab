import {
  useCallback,
  useEffect,
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
import { SimulationControls } from './lab/SimulationControls'
import { Inspector } from './lab/Inspector'
import { classNameForKind, type NodeKind } from './lab/nodeKinds'
import { initialEdges, initialNodes } from './lab/initialDiagram'
import { useDiagramMutations } from './lab/useDiagramMutations'
import { downloadDiagram, parseDiagram } from './lab/exportDiagram'
import { useHandleVisibility, withHandlesVisibleClass } from './lab/useHandleVisibility'
import { useLayoutHelpers } from './lab/useLayoutHelpers'
import { AlignmentGuides } from './lab/AlignmentGuides'
import { DEFAULT_DESIGN_TOKENS, type DesignTokens } from './lab/designTokens'
import { useSimulation } from './sim/useSimulation'
import { createSimStore, hasGeneratorRole, selectEdgeMetrics, selectNodeMetrics, useSimStore } from './sim/store'
import { DEFAULT_TRAFFIC_SCALE, SIGMOID_MAPPING_BY_TRAFFIC_SCALE, type TrafficScale } from './engine/config'

const nodeTypes = { labelNode: LabelNode }
const edgeTypes = { heat: HeatEdge }

type JsonStatus = 'idle' | 'done' | 'error'
const JSON_STATUS_RESET_MS = 1800

function LabEditor() {
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  // Snap-to-node alignment guides while dragging (spec 006, US1) — wraps
  // onNodesChangeBase rather than using onNodeDrag, since that fires too
  // late to influence the applied position (research.md R1/R3/R4).
  const { guides, onNodesChange } = useLayoutHelpers(nodes, onNodesChangeBase)
  const [selection, setSelection] = useState<OnSelectionChangeParams>({ nodes: [], edges: [] })
  const [tokens, setTokens] = useState<DesignTokens>(DEFAULT_DESIGN_TOKENS)
  // True while the user is actively dragging a new connection from a handle —
  // toggled by onConnectStart/onConnectEnd below and read by App.css to reveal
  // every node's handles for the duration of the drag (US2, research.md R4).
  const [connecting, setConnecting] = useState(false)
  // Which order-of-magnitude of req/s counts as "a lot" for this diagram's
  // architecture (src/engine/config.ts) — purely a rendering choice for
  // HeatEdge's animation mapping, not sent to the worker at all (the
  // engine itself has no notion of "peak" traffic).
  const [trafficScale, setTrafficScale] = useState<TrafficScale>(DEFAULT_TRAFFIC_SCALE)

  const mutations = useDiagramMutations(setNodes, setEdges)

  // One Zustand store instance for the lifetime of this editor — created
  // once via useRef rather than per-render, so useSimulation's worker
  // effect (keyed on this same instance) doesn't get recreated either
  // (research.md D4).
  const simStore = useRef(createSimStore()).current
  const runStatus = useSimStore(simStore, (state) => state.runStatus)
  const statusMessage = useSimStore(simStore, (state) => state.statusMessage)
  const latestWindow = useSimStore(simStore, (state) => state.latestWindow)
  const simActions = useSimulation(simStore, nodes, edges)
  const hasGenerator = hasGeneratorRole(nodes)

  // Heat edges color their gradient from the live primary token, so the
  // canvas preview always matches what every export target would produce.
  // Carried through each edge's `data` (rather than closing over it in
  // edgeTypes) so edgeTypes stays a stable reference and React Flow doesn't
  // remount edges on every color change. The EdgeToolbar callbacks ride the
  // same channel (research.md R4); exportDiagram.ts whitelists edge data,
  // so none of these runtime fields can reach the canonical JSON. simMetrics
  // rides the same untracked channel — the latest metrics window for this
  // edge, if the simulation has produced one yet (US2).
  //
  // A metrics window only lists edges that had at least one crossing that
  // tick (buildMetricsWindow), so an edge with zero crossings is simply
  // absent from `latestWindow.edges` — NOT the same thing as "no simulation
  // running". Once a window exists at all, a missing entry means a real,
  // legitimate 0 req/s reading and must flow into HeatEdge's smoothing
  // pipeline like any other sample; only the true idle/reset case (no
  // window yet) should read as `undefined` there, since HeatEdge treats
  // `undefined` as "start this edge's smoothing over from scratch". Passing
  // `undefined` for a merely-quiet window would wrongly reset the EMA/hold
  // state on every quiet tick, which at low request rates is most ticks —
  // defeating the 3s hold and the whole point of the smoothing.
  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          primaryColor: tokens.primaryColor,
          onCycleThickness: mutations.cycleEdgeThickness,
          onReverseDirection: mutations.reverseEdgeDirection,
          simMetrics: latestWindow ? (selectEdgeMetrics(latestWindow, edge.id) ?? { throughputPerSec: 0 }) : undefined,
          mappingConfig: SIGMOID_MAPPING_BY_TRAFFIC_SCALE[trafficScale],
        },
      })),
    [edges, tokens.primaryColor, mutations.cycleEdgeThickness, mutations.reverseEdgeDirection, latestWindow, trafficScale],
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
  // Also resets the simulation run (T033/US3 edge case): an imported
  // topology is unrelated to whatever was mid-run before, so the worker
  // goes back to idle with a blank metrics window rather than silently
  // continuing to simulate the old graph shape for one more tick.
  const handleImportDiagram = useCallback(
    (importedNodes: Node[], importedEdges: Edge[]) => {
      setNodes(importedNodes)
      setEdges(importedEdges)
      setSelection({ nodes: [], edges: [] })
      simActions.reset()
    },
    [setNodes, setEdges, simActions],
  )

  const [jsonExportStatus, setJsonExportStatus] = useState<JsonStatus>('idle')
  const [jsonImportStatus, setJsonImportStatus] = useState<JsonStatus>('idle')
  const uploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (jsonExportStatus === 'idle') return
    const timer = setTimeout(() => setJsonExportStatus('idle'), JSON_STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [jsonExportStatus])

  useEffect(() => {
    if (jsonImportStatus === 'idle') return
    const timer = setTimeout(() => setJsonImportStatus('idle'), JSON_STATUS_RESET_MS)
    return () => clearTimeout(timer)
  }, [jsonImportStatus])

  // The only remaining export target (FR-010): the topology JSON, now
  // including each node's simulation role (exportDiagram.ts).
  const handleExportJson = useCallback(() => {
    try {
      downloadDiagram(nodes, edges)
      setJsonExportStatus('done')
    } catch (error: unknown) {
      console.error('Failed to download diagram JSON', error)
      setJsonExportStatus('error')
    }
  }, [nodes, edges])

  const handleClickUpload = useCallback(() => {
    uploadInputRef.current?.click()
  }, [])

  const handleUploadFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      file
        .text()
        .then((text) => {
          const { nodes: importedNodes, edges: importedEdges } = parseDiagram(text)
          handleImportDiagram(importedNodes, importedEdges)
          setJsonImportStatus('done')
        })
        .catch((error: unknown) => {
          console.error('Failed to import diagram JSON', error)
          setJsonImportStatus('error')
        })
    },
    [handleImportDiagram],
  )

  const jsonExportLabel = jsonExportStatus === 'done' ? 'Downloaded!' : jsonExportStatus === 'error' ? 'Download failed' : 'Export JSON'
  const jsonImportLabel = jsonImportStatus === 'done' ? 'Loaded!' : jsonImportStatus === 'error' ? 'Upload failed' : 'Upload JSON'

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
  const selectedNodeMetrics = selectedNodeId ? selectNodeMetrics(latestWindow, selectedNodeId) : undefined

  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="lab-title">Diagram Lab</span>
        <span className="lab-meta">React Flow authoring tool for system topology diagrams</span>
        <SimulationControls
          runStatus={runStatus}
          statusMessage={statusMessage}
          hasGenerator={hasGenerator}
          trafficScale={trafficScale}
          onStart={simActions.start}
          onPause={simActions.pause}
          onReset={simActions.reset}
          onChangeTrafficScale={setTrafficScale}
        />
        <button type="button" className="lab-export" onClick={handleExportJson}>
          {jsonExportLabel}
        </button>
        <button type="button" className="lab-export" onClick={handleClickUpload}>
          {jsonImportLabel}
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
            <Controls />
            <MiniMap pannable zoomable />
            <AlignmentGuides guides={guides} />
          </ReactFlow>
        </div>
        <Inspector
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          selectedNodeMetrics={selectedNodeMetrics}
          runStatus={runStatus}
          onRenameNode={mutations.renameNode}
          onSetNodeKind={mutations.setNodeKind}
          onSetNodeImage={mutations.setNodeImage}
          onSetNodeLabelSize={mutations.setNodeLabelSize}
          onSetNodeSimRole={mutations.setNodeSimRole}
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
