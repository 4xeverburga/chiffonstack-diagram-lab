import type { HostReplicaTelemetry } from '../engine/ports'
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
}

export function ScalingGroupNode({ sim, liveTelemetry }: ScalingGroupNodeProps) {
  const telemetry = resolveReplicaTelemetry(sim, liveTelemetry)
  const lastEvent = telemetry.events.at(-1)
  const projection = projectScalingGroup(telemetry, lastEvent?.direction ?? null)
  const pulseClass = projection.pulse === 'up' ? ' scaling-pulse-up' : projection.pulse === 'down' ? ' scaling-pulse-down' : ''

  return (
    <div
      key={telemetry.nominalCount}
      className={`scaling-group-box${pulseClass}`}
      style={{ minHeight: projection.groupHeightPx }}
      data-testid="scaling-group-box"
    >
      <div className="scaling-group-chips">
        {projection.visibleChips.map((chip) => (
          <span key={chip.index} className={`scaling-chip${chip.booting ? ' scaling-chip-booting' : ''}`} />
        ))}
      </div>
      <div className="scaling-group-footer">
        <span className="scaling-count-badge">×{telemetry.nominalCount}</span>
        {projection.overflowCount > 0 ? <span className="scaling-overflow-badge">+{projection.overflowCount}</span> : null}
      </div>
    </div>
  )
}
