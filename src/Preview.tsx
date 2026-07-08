import type { CSSProperties } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { LabelNode } from './lab/LabelNode'
import { Sidebar } from './lab/Sidebar'
import { SimulationControls } from './lab/SimulationControls'
import { Inspector } from './lab/Inspector'
import { classNameForKind } from './lab/nodeKinds'
import { applyHostStatusClass } from './lab/hostStatusTreatment'
import { DEFAULT_DESIGN_TOKENS } from './lab/designTokens'
import { DEFAULT_TRAFFIC_SCALE } from './engine/config'
import type { FormulaDescriptor, HostNodeMetrics, NodeMetrics, NodeSim } from './engine/ports'

// Dev-only design/UI preview: mounts the REAL app components (LabelNode,
// Sidebar, SimulationControls, Inspector) fed with representative mock data,
// instead of a hand-copied static HTML mockup. Replaces design-preview.html
// and ui-audit.html, which had already drifted from the real App.css twice
// in one week (see git history) because their markup/CSS was duplicated by
// hand instead of reused. Reached via `npm run dev` -> /preview.html; not a
// build entry point (see vite build input), so it never ships.
const nodeTypes = { labelNode: LabelNode }

function noop() {}

// Mirrors App.tsx's canvasTokenStyle exactly (same DEFAULT_DESIGN_TOKENS),
// so this preview's palette can never silently diverge from a fresh
// diagram's starting tokens.
const canvasTokenStyle = {
  '--token-primary': DEFAULT_DESIGN_TOKENS.primaryColor,
  '--token-secondary': DEFAULT_DESIGN_TOKENS.secondaryColor,
  '--token-heading-font': DEFAULT_DESIGN_TOKENS.headingFont,
  '--token-body-font': DEFAULT_DESIGN_TOKENS.bodyFont,
} as CSSProperties

const HEALTHY_HOST: HostNodeMetrics = {
  incomingRPS: 120,
  forwardedRPS: 120,
  shedRPS: 0,
  saturationRatio: 0.22,
  latencyMs: 12,
  status: 'healthy',
}

const SATURATED_HOST: HostNodeMetrics = {
  incomingRPS: 480,
  forwardedRPS: 480,
  shedRPS: 0,
  saturationRatio: 0.92,
  latencyMs: 68,
  status: 'saturated',
}

const OVERLOADED_HOST: HostNodeMetrics = {
  incomingRPS: 640,
  forwardedRPS: 550,
  shedRPS: 90,
  saturationRatio: 1.28,
  latencyMs: 210,
  status: 'overloaded',
}

const HOST_FORMULAS: FormulaDescriptor[] = [
  {
    id: 'host.saturation-ratio',
    name: 'Saturation ratio (\u03c1)',
    expression: 'rho = incomingRPS / capacityRPS',
    inputs: { incomingRPS: 640, capacityRPS: 500 },
    sources: [{ title: 'Kleinrock, Queueing Systems Vol. 1 (1975)', url: 'https://www.wiley.com/en-us/Queueing+Systems' }],
    isBinding: true,
  },
  {
    id: 'host.hockey-stick-latency',
    name: 'Latency under load',
    expression: 'latencyMs = baseLatencyMs * (1 + rho / (1 - rho))',
    inputs: { baseLatencyMs: 10, saturationRatio: 1.28 },
    sources: [{ title: 'Harchol-Balter, Performance Modeling and Design of Computer Systems (2013)', url: 'https://www.cs.cmu.edu/~harchol/Perfbook/book.html' }],
    isBinding: true,
  },
]

const CLIENT_POOL_SIM: NodeSim = { kind: 'host', profile: 'client_pool', requestRatePerSec: 500 }
const MANUAL_API_SIM: NodeSim = {
  kind: 'host',
  profile: 'transactional_api',
  configMode: 'manual',
  manualBaselineLatencyMs: 10,
  manualSaturationRPS: 500,
  manualMaxRPS: 550,
  overloadBehavior: 'collapse',
  minReplicas: 1,
  maxReplicas: 1,
  bootDelayMs: 8000,
  highWatermark: 0.8,
  lowWatermark: 0.3,
}
const QUEUE_SIM: NodeSim = { kind: 'queue' }

function canvasNode(id: string, label: string, x: number, className: string, sim: NodeSim | undefined, metrics: NodeMetrics | undefined): Node {
  return { id, type: 'labelNode', position: { x, y: 0 }, data: { label, sim, simMetrics: metrics }, className }
}

// The exact states shown in DESIGN.md's canvas-node section: default,
// selected (healthy host), dim, saturated, and overloaded — matching the
// screenshot this preview replaces.
const CANVAS_NODES: Node[] = [
  canvasNode('client-pool', 'client-pool', 0, classNameForKind('default'), CLIENT_POOL_SIM, undefined),
  canvasNode('api-healthy', 'api-healthy', 220, classNameForKind('active'), MANUAL_API_SIM, {
    throughputPerSec: 120,
    queueDepth: 0,
    host: HEALTHY_HOST,
  }),
  canvasNode('queue', 'queue', 440, classNameForKind('dim'), QUEUE_SIM, {
    throughputPerSec: 90,
    queueDepth: 512,
    queue: { inflowMBps: 20, outflowMBps: 12, backlogGB: 0.6 },
  }),
  canvasNode(
    'api-saturated',
    'api-saturated',
    660,
    applyHostStatusClass(classNameForKind('default'), 'saturated'),
    MANUAL_API_SIM,
    { throughputPerSec: 480, queueDepth: 0, host: SATURATED_HOST, formulaDescriptors: HOST_FORMULAS },
  ),
  canvasNode(
    'api-overloaded',
    'api-overloaded',
    880,
    applyHostStatusClass(classNameForKind('default'), 'overloaded'),
    MANUAL_API_SIM,
    { throughputPerSec: 550, queueDepth: 0, host: OVERLOADED_HOST, formulaDescriptors: HOST_FORMULAS },
  ),
]

// Worst-case density audit target (ui-audit.html's former purpose): the
// Inspector's tallest possible state, an overloaded host with every
// formula/meter section expanded.
const INSPECTOR_NODE: Node = canvasNode(
  'api-overloaded',
  'api-overloaded',
  0,
  applyHostStatusClass(classNameForKind('default'), 'overloaded'),
  MANUAL_API_SIM,
  undefined,
)
const INSPECTOR_METRICS: NodeMetrics = {
  throughputPerSec: 550,
  queueDepth: 0,
  host: OVERLOADED_HOST,
  formulaDescriptors: HOST_FORMULAS,
}

function Preview() {
  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="lab-title">SUGAR</span>
        <span className="lab-meta">Design/UI preview — real components, mock data, dev-only</span>
        <SimulationControls
          runStatus="idle"
          statusMessage={undefined}
          hasGenerator
          trafficScale={DEFAULT_TRAFFIC_SCALE}
          onStart={noop}
          onPause={noop}
          onReset={noop}
          onChangeTrafficScale={noop}
        />
      </header>
      <div className="lab-body">
        <Sidebar onAddNode={noop} tokens={DEFAULT_DESIGN_TOKENS} onChangeTokens={noop} />
        <div className="lab-canvas" style={canvasTokenStyle}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={CANVAS_NODES}
              edges={[]}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            />
          </ReactFlowProvider>
        </div>
        <Inspector
          selectedNode={INSPECTOR_NODE}
          selectedEdge={undefined}
          selectedNodeMetrics={INSPECTOR_METRICS}
          selectedEdgeMetrics={undefined}
          runStatus="idle"
          onRenameNode={noop}
          onSetNodeKind={noop}
          onSetNodeImage={noop}
          onSetNodeLabelSize={noop}
          onSetNodeSim={noop}
          onSetEdgeVariant={noop}
          onSetEdgeThickness={noop}
          onSetEdgeSimConfig={noop}
          onReverseEdgeDirection={noop}
          onDeleteEdge={noop}
        />
      </div>
    </div>
  )
}

export default Preview

