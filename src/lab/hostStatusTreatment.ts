import type { HostNodeMetrics } from '../engine/ports'

const STATUS_CLASS_PREFIX = 'sim-status-'
const APPLIED_STATUSES = ['saturated', 'overloaded', 'collapsed'] as const

// Maps a host's per-window status to the canvas node treatment vocabulary
// (App.css's .sim-status-saturated/.sim-status-overloaded — border color +
// distinct glow animation pattern, FR-013). 'healthy' carries no treatment
// class at all, matching the pre-simulation default look.
//
// Idempotent by construction (strips any existing status token before
// deciding whether to reapply one) rather than a blind append — required
// because this recomputes every render off the SAME node objects React
// Flow's own store holds, and NodeResizer's onResize round-trips through
// updateNode, which would otherwise bake a stale status class in as
// permanent state (see user memory: the className-derivation trap this
// exact pattern avoids, first documented for useHandleVisibility.ts).
export function applyHostStatusClass(className: string | undefined, status: HostNodeMetrics['status'] | undefined): string {
  const tokens = (className ?? '')
    .split(' ')
    .filter((token) => token.length > 0)
    .filter((token) => !APPLIED_STATUSES.some((s) => token === `${STATUS_CLASS_PREFIX}${s}`))
  if (status === 'saturated' || status === 'overloaded' || status === 'collapsed') tokens.push(`${STATUS_CLASS_PREFIX}${status}`)
  return tokens.join(' ')
}
