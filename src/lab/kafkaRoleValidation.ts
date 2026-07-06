// Pure per-field validators for the kafka/producer/consumer Inspector
// fields (feature 010, data-model.md). Every rule mirrors 009's own
// engine-side checks (specs/009-kafka-simulation-model/contracts/
// engine-kafka-ports.md §1, and buildTopologyGraph's producer payload
// guard) so a value the Inspector accepts can never be rejected downstream
// by the engine. Each function rejects with a specific message and never
// clamps — the Inspector keeps the last valid value on rejection, same as
// 008's SimRoleFields pattern.

export type FieldValidationResult = { value: number } | { error: string }

function parseFiniteNumber(text: string): number | undefined {
  if (text.trim() === '') return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : undefined
}

export function validatePartitions(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return { error: 'Partitions must be a whole number \u2265 1.' }
  }
  return { value }
}

export function validateReplicationFactor(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    return { error: 'Replication factor must be a whole number \u2265 1.' }
  }
  return { value }
}

export function validateRetentionBytes(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || value < 0) {
    return { error: 'Retention must be a number \u2265 0 bytes.' }
  }
  return { value }
}

export function validateProducerRate(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || value < 0) {
    return { error: 'Message rate must be a number \u2265 0.' }
  }
  return { value }
}

export function validateAveragePayloadBytes(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || value <= 0) {
    return { error: 'Average payload size must be a number > 0 bytes (needed for req/s \u2194 MB/s conversion).' }
  }
  return { value }
}

export function validateConsumeRate(text: string): FieldValidationResult {
  const value = parseFiniteNumber(text)
  if (value === undefined || value < 0) {
    return { error: 'Consume rate must be a number \u2265 0.' }
  }
  return { value }
}
