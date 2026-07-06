import type { CSSProperties } from 'react'
import { ReactFlow, ReactFlowProvider, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { LabelNode } from './lab/LabelNode'
import { Sidebar } from './lab/Sidebar'
import { SimulationControls } from './lab/SimulationControls'
import { Inspector } from './lab/Inspector'
import { classNameForKind } from './lab/nodeKinds'
import { applyKafkaStatusClass } from './lab/kafkaStatusTreatment'
import { DEFAULT_DESIGN_TOKENS } from './lab/designTokens'
import { DEFAULT_TRAFFIC_SCALE } from './engine/config'
import type { FormulaDescriptor, KafkaNodeMetrics, NodeMetrics, SimRole } from './engine/ports'

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

const HEALTHY_KAFKA: KafkaNodeMetrics = {
  ingressMBps: 120,
  egressMBps: 118,
  saturation: { network: 0.22, cpu: 0.18, disk: 0.15 },
  consumerLagBytes: 2_000_000,
  consumerLagMessages: 1_500,
  pageCacheHitRatio: 0.97,
  status: 'healthy',
}

const SATURATED_KAFKA: KafkaNodeMetrics = {
  ingressMBps: 512,
  egressMBps: 480,
  saturation: { network: 0.62, cpu: 0.55, disk: 0.94 },
  consumerLagBytes: 131_072_000,
  consumerLagMessages: 128_000,
  pageCacheHitRatio: 0.78,
  status: 'saturated',
}

const DEGRADED_KAFKA: KafkaNodeMetrics = {
  ingressMBps: 640,
  egressMBps: 210,
  saturation: { network: 0.71, cpu: 0.68, disk: 0.99 },
  consumerLagBytes: 900_000_000,
  consumerLagMessages: 820_000,
  pageCacheHitRatio: 0.31,
  status: 'degraded',
}

const KAFKA_FORMULAS: FormulaDescriptor[] = [
  {
    id: 'disk-throughput',
    name: 'Disk throughput',
    expression: 'disk_util = (retention_bytes / disk_capacity_bytes) \u00d7 100',
    inputs: { retention_bytes: 1_000_000_000, disk_capacity_bytes: 214_748_364_800 },
    sources: [{ title: 'AWS m6i spec sheet', url: 'https://aws.amazon.com/ec2/instance-types/m6i/' }],
    isBinding: true,
  },
  {
    id: 'network-throughput',
    name: 'Network throughput',
    expression: 'net_util = (throughput_MBps / nic_capacity_MBps) \u00d7 100',
    inputs: { throughput_MBps: 465, nic_capacity_MBps: 750 },
    sources: [{ title: 'AWS network baseline', url: 'https://aws.amazon.com/ec2/instance-types/m6i/' }],
    isBinding: false,
  },
  {
    id: 'cpu-utilization',
    name: 'CPU utilization',
    expression: 'cpu_util = (msg_rate / max_msgs_per_core) \u00d7 100 / vcpu',
    inputs: { msg_rate: 2_048, vcpu: 2 },
    sources: [{ title: 'Kafka broker sizing guide', url: 'https://kafka.apache.org/documentation/' }],
    isBinding: false,
  },
]

const KAFKA_SIM_ROLE: SimRole = {
  role: 'kafka',
  hardwareProfile: 'm6i.large',
  partitions: 3,
  replicationFactor: 2,
  tlsEnabled: false,
  compression: 'none',
  retentionBytes: 1_000_000_000,
}

function canvasNode(
  id: string,
  label: string,
  x: number,
  className: string,
  sim: SimRole | undefined,
  metrics: NodeMetrics | undefined,
): Node {
  return { id, type: 'labelNode', position: { x, y: 0 }, data: { label, sim, simMetrics: metrics }, className }
}

// The exact five states shown in DESIGN.md's canvas-node section: default,
// selected (healthy kafka), dim, saturated, and degraded — matching the
// screenshot this preview replaces.
const CANVAS_NODES: Node[] = [
  canvasNode('producer-01', 'producer-01', 0, classNameForKind('default'), {
    role: 'producer',
    messageRatePerSec: 500,
    averagePayloadBytes: 1024,
  }, undefined),
  canvasNode('kafka-01', 'kafka-01', 220, classNameForKind('active'), KAFKA_SIM_ROLE, {
    throughputPerSec: 500,
    queueDepth: 0,
    kafka: HEALTHY_KAFKA,
  }),
  canvasNode('consumer-01', 'consumer-01', 440, classNameForKind('dim'), { role: 'consumer', consumeRatePerSec: 500 }, undefined),
  canvasNode(
    'kafka-02',
    'kafka-02',
    660,
    applyKafkaStatusClass(classNameForKind('default'), 'saturated'),
    KAFKA_SIM_ROLE,
    { throughputPerSec: 2048, queueDepth: 128_000, kafka: SATURATED_KAFKA, formulaDescriptors: KAFKA_FORMULAS },
  ),
  canvasNode(
    'kafka-03',
    'kafka-03',
    880,
    applyKafkaStatusClass(classNameForKind('default'), 'degraded'),
    KAFKA_SIM_ROLE,
    { throughputPerSec: 1024, queueDepth: 820_000, kafka: DEGRADED_KAFKA, formulaDescriptors: KAFKA_FORMULAS },
  ),
]

// Worst-case density audit target (ui-audit.html's former purpose): the
// Inspector's tallest possible state, a saturated Kafka node with every
// formula/meter section expanded.
const INSPECTOR_NODE: Node = canvasNode(
  'kafka-02',
  'kafka-02',
  0,
  applyKafkaStatusClass(classNameForKind('default'), 'saturated'),
  KAFKA_SIM_ROLE,
  undefined,
)
const INSPECTOR_METRICS: NodeMetrics = {
  throughputPerSec: 2048,
  queueDepth: 128_000,
  kafka: SATURATED_KAFKA,
  formulaDescriptors: KAFKA_FORMULAS,
}

function Preview() {
  return (
    <div className="lab">
      <header className="lab-bar">
        <span className="lab-title">Diagram Lab</span>
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
          runStatus="idle"
          onRenameNode={noop}
          onSetNodeKind={noop}
          onSetNodeImage={noop}
          onSetNodeLabelSize={noop}
          onSetNodeSimRole={noop}
          onSetEdgeVariant={noop}
          onSetEdgeThickness={noop}
          onReverseEdgeDirection={noop}
          onDeleteEdge={noop}
        />
      </div>
    </div>
  )
}

export default Preview
