// Pure formatting for HeatEdge's dual-unit (native rate + MB/s) label
// (feature 010, US3/FR-007). Split out so the formatting itself is
// unit-testable without rendering an edge (Principle VI). Grouped
// thousands + trimmed trailing zeros (Intl.NumberFormat's default
// minimumFractionDigits: 0) keep large simulated rates (e.g. 2,000,000
// msg/s) legible instead of a raw "2000000.0".
const NATIVE_RATE_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const MB_PER_SEC_FORMATTER = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export function formatDualUnitLabel(nativeThroughputPerSec: number, throughputMBps: number): string {
  return `${NATIVE_RATE_FORMATTER.format(nativeThroughputPerSec)} msg/s · ${MB_PER_SEC_FORMATTER.format(throughputMBps)} MB/s`
}
