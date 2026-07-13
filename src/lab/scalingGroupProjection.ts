// Pure visual-projection helper for a scaled host's on-canvas treatment
// (data-model.md ScalingGroupProjection; spec User Story 4, reworked to a
// capacity-bar treatment — see ScalingGroupNode.tsx for the visual
// rationale). Deliberately NOT wired into React Flow's node/subflow
// machinery — see specs/013-host-autoscaling's implementation notes for
// the scope decision (a full box-container + individual draggable child
// nodes carries real risk to the existing canvas render pipeline without a
// live-browser iteration loop to validate it against). This module still
// delivers the FULLY TESTABLE, engine-independent piece: given a scaled
// host's replica telemetry and its declared maxReplicas, compute exactly
// what ScalingGroupNode needs to render — kept pure so it's unit-testable
// without mounting React (constitution VI).
import { MAX_DISCRETE_CAPACITY_SEGMENTS } from 'sugar-skills'
import type { HostReplicaTelemetry } from 'sugar-skills'

export type ScalingGroupMode = 'segments' | 'proportional'

export interface ScalingGroupSegment {
  index: number
  /** Whether this declared slot currently holds a replica (index <
   *  nominalCount) — slots beyond nominalCount up to maxReplicas render as
   *  empty "declared but not currently scaled to" capacity, which the old
   *  chip-list treatment never showed at all. */
  active: boolean
  /** Occupied but not yet past its boot delay (only meaningful when
   *  active). */
  booting: boolean
}

export interface ScalingGroupProjection {
  /** 'segments' below MAX_DISCRETE_CAPACITY_SEGMENTS declared slots (each
   *  slot gets its own tick on the bar); 'proportional' above it, where
   *  individual ticks would render as unreadable slivers, so the bar
   *  coalesces into a single continuous fill instead. Purely a rendering
   *  choice — maxReplicas is the scaler's real, already-enforced ceiling
   *  either way; nominalCount can never exceed it (see autoscaler.ts), so
   *  there is no overflow to report in either mode. */
  mode: ScalingGroupMode
  /** One entry per declared replica slot (index 0..maxReplicas-1); empty
   *  in 'proportional' mode, where fillRatio/bootingRatio drive the render
   *  instead. */
  segments: ScalingGroupSegment[]
  /** nominalCount / maxReplicas, in [0, 1] — the bar's fill width in
   *  'proportional' mode. */
  fillRatio: number
  /** bootingCount / maxReplicas — the dashed/pulsing sliver at the fill's
   *  leading edge in 'proportional' mode. */
  bootingRatio: number
  nominalCount: number
  maxReplicas: number
  /** Transient treatment on the most recent scaling event, or null if the
   *  host has never scaled (or its most recent event already faded). */
  pulse: 'up' | 'down' | null
}

// A host with min = max = 1 renders as a plain host node — no group box
// (spec User Story 4 acceptance scenario 1) — callers should check this
// before invoking projectScalingGroup at all; kept as a standalone
// predicate so it's usable from both the projection call site and any
// canvas node-type decision.
export function isScalingGroupHost(minReplicas: number, maxReplicas: number): boolean {
  return minReplicas !== maxReplicas || minReplicas > 1
}

// Pure telemetry -> projection mapping (data-model.md). Booting replicas
// are always the newest ones (appended to the end of the FIFO), so in
// 'segments' mode they're flagged at the tail of the ACTIVE slots — a
// freshly-added replica appears to "fill in" at the leading edge of the
// bar, same spot a new chip used to "pop in" at in the old vertical stack.
export function projectScalingGroup(
  telemetry: HostReplicaTelemetry,
  maxReplicas: number,
  pulse: 'up' | 'down' | null,
): ScalingGroupProjection {
  const mode: ScalingGroupMode = maxReplicas <= MAX_DISCRETE_CAPACITY_SEGMENTS ? 'segments' : 'proportional'
  const segments: ScalingGroupSegment[] = []
  if (mode === 'segments') {
    for (let index = 0; index < maxReplicas; index += 1) {
      const active = index < telemetry.nominalCount
      const booting = active && index >= telemetry.nominalCount - telemetry.bootingCount
      segments.push({ index, active, booting })
    }
  }
  const fillRatio = maxReplicas > 0 ? telemetry.nominalCount / maxReplicas : 0
  const bootingRatio = maxReplicas > 0 ? telemetry.bootingCount / maxReplicas : 0
  return { mode, segments, fillRatio, bootingRatio, nominalCount: telemetry.nominalCount, maxReplicas, pulse }
}

// Whether a host's sim currently warrants rendering the scaling-group
// visual at all (ScalingGroupNode.tsx) — kept alongside isScalingGroupHost
// here (rather than in the .tsx component file) purely so that file only
// ever exports a React component, which oxlint's react/only-export-
// components fast-refresh rule requires (see FormulaPanel.tsx/
// formulaPanelState.ts for the existing precedent of this split).
export function shouldRenderScalingGroup(
  sim: { minReplicas: number; maxReplicas: number } | undefined,
): sim is { minReplicas: number; maxReplicas: number } {
  return Boolean(sim) && isScalingGroupHost(sim!.minReplicas, sim!.maxReplicas)
}

// Falls back to a static "minReplicas, nothing booting, no events"
// telemetry snapshot before the simulation has ever produced a metrics
// window (data.simMetrics is undefined at idle) — so the bar already
// reflects the CONFIGURED bounds instead of only appearing once Start is
// clicked.
export function resolveReplicaTelemetry(
  sim: { minReplicas: number; maxReplicas: number },
  liveTelemetry: HostReplicaTelemetry | undefined,
): HostReplicaTelemetry {
  return (
    liveTelemetry ?? {
      nominalCount: sim.minReplicas,
      bootingCount: 0,
      effectiveCount: sim.minReplicas,
      perReplicaSaturation: 0,
      events: [],
    }
  )
}
