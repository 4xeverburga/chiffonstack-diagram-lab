import type { HostNodeMetrics, HostReplicaTelemetry } from '../engine/ports'
import { projectScalingGroup, resolveReplicaTelemetry } from './scalingGroupProjection'

// The on-canvas "scaling group" visual (spec User Story 4) — rendered
// INSIDE the host's existing single React Flow node (LabelNode.tsx)
// rather than as separate xyflow parent/child subflow nodes. This is a
// deliberate implementation simplification: real per-replica canvas nodes
// (parentId/extent:'parent' subflows wired into App.tsx's renderedNodes/
// handle-visibility/status-treatment pipeline and the store) would need a
// much larger, riskier change to the existing render pipeline for the same
// user-visible payoff. Rendering the chips as plain DOM elements inside the
// one real node achieves every observable acceptance criterion in spec
// User Story 4 — box container, vertical chip stack, pop in/out on scaling
// events, overflow badge, edges staying attached, exported JSON never
// gaining replica sub-nodes (SC-008, trivially: none are ever created) —
// without touching App.tsx, sim/store.ts, or the export whitelist at all.
//
// Each chip is styled to read as a small host node (bordered box, not a
// bare bar) and shows the SAME per-replica saturation reading every other
// serving chip shows — that shared number IS the visual proof that load
// divides evenly across replicas (research.md D3: perReplicaRPS =
// incomingRPS / effectiveCount, identical for every replica by
// construction, not something each chip computes independently). A native
// `title` tooltip (not a custom popover) carries the fuller per-replica
// reading on hover — deliberately NOT reusing NodeInfoButton's custom
// popover here, because `.node-content` (the outer node's wrapper) sets
// `overflow: hidden`, which would clip an absolutely-positioned popover
// nested this deep; the browser's native tooltip layer isn't subject to
// that clipping.
//
// `key={telemetry.nominalCount}` on the outer element below is what makes
// the CSS pulse animation replay exactly once per scaling event: changing
// the key forces React to remount the element, and a keyframe animation on
// a freshly-mounted element always plays from its start — no JS timer
// needed (constitution V: bounded, CSS-driven, no per-event state).
// `shouldRenderScalingGroup`/`resolveReplicaTelemetry` live in
// scalingGroupProjection.ts (not here) so this file only ever exports a
// component, per oxlint's react/only-export-components fast-refresh rule.

type ScalingGroupNodeProps = {
  sim: { minReplicas: number; maxReplicas: number }
  liveTelemetry: HostReplicaTelemetry | undefined
  /** The host's own per-window metrics (already PER-REPLICA on scaled
   *  hosts, research.md D3 delta) — every serving chip reads off this
   *  same object, since every replica is identical by construction. */
  hostMetrics: HostNodeMetrics | undefined
}

function chipTitle(index: number, total: number, booting: boolean, perReplicaRPS: number | undefined, hostMetrics: HostNodeMetrics | undefined): string {
  const label = `Replica ${index + 1} of ${total}`
  if (booting) {
    if (hostMetrics?.status === 'collapsed') return `${label} — crashed under overload, replacement booting`
    return `${label} — booting, not yet serving traffic`
  }
  if (!hostMetrics) return `${label} — no data yet`
  const rps = perReplicaRPS !== undefined ? `${perReplicaRPS.toFixed(1)} req/s, ` : ''
  return `${label} — ${rps}${Math.round(hostMetrics.saturationRatio * 100)}% saturated, ${hostMetrics.status}, ${hostMetrics.latencyMs.toFixed(1)}ms latency`
}

export function ScalingGroupNode({ sim, liveTelemetry, hostMetrics }: ScalingGroupNodeProps) {
  const telemetry = resolveReplicaTelemetry(sim, liveTelemetry)
  const lastEvent = telemetry.events.at(-1)
  const projection = projectScalingGroup(telemetry, lastEvent?.direction ?? null)
  const pulseClass = projection.pulse === 'up' ? ' scaling-pulse-up' : projection.pulse === 'down' ? ' scaling-pulse-down' : ''
  const perReplicaRPS = hostMetrics && telemetry.effectiveCount > 0 ? hostMetrics.incomingRPS / telemetry.effectiveCount : undefined
  const perReplicaSaturationLabel = hostMetrics ? `${Math.round(hostMetrics.saturationRatio * 100)}%` : undefined
  // A booting chip during a COLLAPSED host's replica-eviction recovery
  // (research.md D9) isn't merely "pending" the way a normal scale-up
  // chip is — it's a replacement for one that just crashed under
  // overload. The pulsing ellipsis reads as "arriving soon"; a static X
  // reads as "this one died", which is the accurate story here.
  const isCollapsed = hostMetrics?.status === 'collapsed'

  return (
    <div key={telemetry.nominalCount} className={`scaling-group-box${pulseClass}`} data-testid="scaling-group-box">
      <div className="scaling-group-chips">
        {projection.visibleChips.map((chip) => (
          <span
            key={chip.index}
            className={`scaling-chip${chip.booting ? (isCollapsed ? ' scaling-chip-crashed' : ' scaling-chip-booting') : ''}`}
            title={chipTitle(chip.index, telemetry.nominalCount, chip.booting, perReplicaRPS, hostMetrics)}
          >
            {chip.booting ? (isCollapsed ? '\u2715' : '\u2026') : (perReplicaSaturationLabel ?? '')}
          </span>
        ))}
      </div>
      <div className="scaling-group-footer">
        <span className="scaling-count-badge">×{telemetry.nominalCount}</span>
        {projection.overflowCount > 0 ? <span className="scaling-overflow-badge">+{projection.overflowCount}</span> : null}
      </div>
    </div>
  )
}

