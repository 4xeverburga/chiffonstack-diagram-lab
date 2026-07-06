import type { KafkaNodeMetrics } from '../engine/ports'

// Idempotent className derivation for a Kafka node's canvas status
// treatment (saturated/degraded), following the exact pattern already used
// by `withHandlesVisibleClass` (useHandleVisibility.ts): these node
// objects are handed straight to <ReactFlow nodes>, and React Flow's own
// store round-trips them (e.g. NodeResizer's onResize reads the
// currently-rendered node, already carrying this class, and merges its own
// patch on top via updateNode) — a blind append would bake a permanent,
// possibly-duplicated status class into real node state. Stripping any
// existing `sim-status-*` token before deciding whether to reapply one
// makes this self-correcting every render regardless of prior state.
const STATUS_CLASS_PREFIX = 'sim-status-'

export function applyKafkaStatusClass(
  className: string | undefined,
  status: KafkaNodeMetrics['status'] | undefined,
): string {
  const baseClassName = (className ?? '')
    .split(' ')
    .filter((token) => token && !token.startsWith(STATUS_CLASS_PREFIX))
    .join(' ')
  if (status === 'saturated' || status === 'degraded') {
    return `${baseClassName} ${STATUS_CLASS_PREFIX}${status}`.trim()
  }
  return baseClassName
}
