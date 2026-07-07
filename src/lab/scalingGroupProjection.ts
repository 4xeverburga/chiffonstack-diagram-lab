// Pure visual-projection helper for a scaled host's on-canvas treatment
// (data-model.md ScalingGroupProjection; spec User Story 4). Deliberately
// NOT wired into React Flow's node/subflow machinery in this pass — see
// specs/013-host-autoscaling's implementation notes for the scope
// decision (a full box-container + individual draggable child chip nodes
// carries real risk to the existing canvas render pipeline without a
// live-browser iteration loop to validate it against). This module still
// delivers the FULLY TESTABLE, engine-independent piece: given a scaled
// host's replica telemetry, compute exactly what a future ScalingGroupNode
// would need to render (visible chip count/booting flags, overflow badge,
// vertical layout metrics, transient pulse direction) — kept pure so it's
// unit-testable without mounting React (constitution VI) regardless of
// when the visual lands.
import { VISIBLE_REPLICA_CAP } from '../engine/config'
import type { HostReplicaTelemetry } from '../engine/ports'

export interface ScalingGroupChip {
  index: number
  booting: boolean
}

export interface ScalingGroupProjection {
  visibleChips: ScalingGroupChip[]
  /** nominalCount - visible.length, >= 0 → the "+N" overflow badge. */
  overflowCount: number
  /** Vertical stack layout: one row per visible chip plus fixed padding. */
  groupHeightPx: number
  /** Transient treatment on the most recent scaling event, or null if the
   *  host has never scaled (or its most recent event already faded). */
  pulse: 'up' | 'down' | null
}

const CHIP_HEIGHT_PX = 28
const CHIP_GAP_PX = 6
const GROUP_PADDING_PX = 16

// A host with min = max = 1 renders as a plain host node — no group box
// (spec User Story 4 acceptance scenario 1) — callers should check this
// before invoking projectScalingGroup at all; kept as a standalone
// predicate so it's usable from both the projection call site and any
// canvas node-type decision.
export function isScalingGroupHost(minReplicas: number, maxReplicas: number): boolean {
  return minReplicas !== maxReplicas || minReplicas > 1
}

// Pure telemetry -> projection mapping (data-model.md). `nominalCount` is
// only used to size the overflow badge — this counts BOOTING chips first
// among the visible slots (a host with more booting entries than
// VISIBLE_REPLICA_CAP would prioritize showing them, but in practice
// booting count is always small relative to nominal since it's gated by
// cooldown).
export function projectScalingGroup(telemetry: HostReplicaTelemetry, pulse: 'up' | 'down' | null): ScalingGroupProjection {
  const visibleCount = Math.min(telemetry.nominalCount, VISIBLE_REPLICA_CAP)
  const bootingCount = Math.min(telemetry.bootingCount, visibleCount)
  const visibleChips: ScalingGroupChip[] = []
  for (let index = 0; index < visibleCount; index += 1) {
    // Booting replicas are the newest ones (appended to the end of the
    // FIFO) — shown at the tail of the visible stack so a freshly-added
    // chip appears to "pop in" at the bottom (spec User Story 4).
    visibleChips.push({ index, booting: index >= visibleCount - bootingCount })
  }
  const overflowCount = Math.max(0, telemetry.nominalCount - visibleChips.length)
  const groupHeightPx = GROUP_PADDING_PX * 2 + visibleChips.length * CHIP_HEIGHT_PX + Math.max(0, visibleChips.length - 1) * CHIP_GAP_PX
  return { visibleChips, overflowCount, groupHeightPx, pulse }
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
// window (data.simMetrics is undefined at idle) — so the box/chip count
// already reflects the CONFIGURED bounds instead of only appearing once
// Start is clicked.
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
