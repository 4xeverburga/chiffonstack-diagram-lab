import type { HostNodeMetrics, HostReplicaTelemetry } from '../engine/ports'
import { projectScalingGroup, resolveReplicaTelemetry } from './scalingGroupProjection'

// The on-canvas "scaling group" visual (spec User Story 4) — rendered
// INSIDE the host's existing single React Flow node (LabelNode.tsx)
// rather than as separate xyflow parent/child subflow nodes. This is a
// deliberate implementation simplification: real per-replica canvas nodes
// (parentId/extent:'parent' subflows wired into App.tsx's renderedNodes/
// handle-visibility/status-treatment pipeline and the store) would need a
// much larger, riskier change to the existing render pipeline for the same
// user-visible payoff. Rendering the bar as plain DOM elements inside the
// one real node achieves every observable acceptance criterion in spec
// User Story 4 — box container, pop in/out on scaling events, edges
// staying attached, exported JSON never gaining replica sub-nodes
// (SC-008, trivially: none are ever created) — without touching App.tsx,
// sim/store.ts, or the export whitelist at all.
//
// Reworked from a vertical chip-per-replica stack (which needed a "+N"
// overflow badge once nominalCount passed a small visible cap, and read as
// a layout jump every time a chip popped in/out) to a fixed-height
// horizontal capacity bar (scalingGroupProjection.ts): below
// MAX_DISCRETE_CAPACITY_SEGMENTS declared slots each replica gets its own
// tick (active/booting/empty), matching a fuel-gauge metaphor — above it,
// individual ticks would be unreadable slivers, so the bar coalesces into
// one continuous proportional fill instead. Either way the bar's own
// footprint never grows with replica count, so there's no overflow to
// report and nothing to animate a height change for.
//
// `title` (native tooltip, not NodeInfoButton's custom popover) carries
// the fuller per-replica reading on hover — deliberately not a custom
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
   *  hosts, research.md D3 delta) — every serving replica reads off this
   *  same object, since every replica is identical by construction. */
  hostMetrics: HostNodeMetrics | undefined
}

function segmentTitle(
  index: number,
  maxReplicas: number,
  active: boolean,
  booting: boolean,
  perReplicaRPS: number | undefined,
  hostMetrics: HostNodeMetrics | undefined,
): string {
  const label = `Replica slot ${index + 1} of ${maxReplicas}`
  if (!active) return `${label} — not currently scaled to`
  if (booting) return `${label} — booting, not yet serving traffic`
  if (!hostMetrics) return `${label} — no data yet`
  const rps = perReplicaRPS !== undefined ? `${perReplicaRPS.toFixed(1)} req/s, ` : ''
  return `${label} — ${rps}${Math.round(hostMetrics.saturationRatio * 100)}% saturated, ${hostMetrics.status}, ${hostMetrics.latencyMs.toFixed(1)}ms latency`
}

function proportionalTitle(
  nominalCount: number,
  maxReplicas: number,
  bootingCount: number,
  perReplicaRPS: number | undefined,
  hostMetrics: HostNodeMetrics | undefined,
): string {
  const bootingNote = bootingCount > 0 ? ` (${bootingCount} booting)` : ''
  const label = `${nominalCount} of ${maxReplicas} declared replicas active${bootingNote}`
  if (!hostMetrics) return `${label} — no data yet`
  const rps = perReplicaRPS !== undefined ? `${perReplicaRPS.toFixed(1)} req/s per replica, ` : ''
  return `${label} — ${rps}${Math.round(hostMetrics.saturationRatio * 100)}% saturated per replica, ${hostMetrics.status}`
}

export function ScalingGroupNode({ sim, liveTelemetry, hostMetrics }: ScalingGroupNodeProps) {
  const telemetry = resolveReplicaTelemetry(sim, liveTelemetry)
  const lastEvent = telemetry.events.at(-1)
  const projection = projectScalingGroup(telemetry, sim.maxReplicas, lastEvent?.direction ?? null)
  const pulseClass = projection.pulse === 'up' ? ' scaling-pulse-up' : projection.pulse === 'down' ? ' scaling-pulse-down' : ''
  const perReplicaRPS = hostMetrics && telemetry.effectiveCount > 0 ? hostMetrics.incomingRPS / telemetry.effectiveCount : undefined

  const fillPercent = Math.min(1, projection.fillRatio) * 100
  const bootingPercent = Math.min(1, projection.bootingRatio) * 100
  const bootingLeftPercent = Math.max(0, fillPercent - bootingPercent)

  return (
    <div key={telemetry.nominalCount} className={`scaling-group-box${pulseClass}`} data-testid="scaling-group-box">
      {projection.mode === 'segments' ? (
        <div className="capacity-bar" data-testid="capacity-bar-segments">
          {projection.segments.map((segment) => (
            <span
              key={segment.index}
              className={`capacity-seg${segment.active ? ' capacity-seg-active' : ''}${segment.booting ? ' capacity-seg-booting' : ''}`}
              title={segmentTitle(segment.index, projection.maxReplicas, segment.active, segment.booting, perReplicaRPS, hostMetrics)}
            />
          ))}
        </div>
      ) : (
        <div
          className="capacity-bar-proportional"
          data-testid="capacity-bar-proportional"
          title={proportionalTitle(projection.nominalCount, projection.maxReplicas, telemetry.bootingCount, perReplicaRPS, hostMetrics)}
        >
          <div className="capacity-fill" style={{ width: `${fillPercent}%` }} />
          {bootingPercent > 0 ? (
            <div className="capacity-fill-booting" style={{ left: `${bootingLeftPercent}%`, width: `${bootingPercent}%` }} />
          ) : null}
        </div>
      )}
      <div className="scaling-group-footer">
        <span className="scaling-count-badge">×{telemetry.nominalCount}</span>
        <span className="scaling-max-label">/{projection.maxReplicas}</span>
      </div>
    </div>
  )
}

