import { useState, type ChangeEvent } from 'react'
import { KAFKA_HARDWARE_PROFILES } from '../engine/kafka/catalog'
import type { KafkaCompression, SimRole } from '../engine/ports'
import {
  validateAveragePayloadBytes,
  validateConsumeRate,
  validatePartitions,
  validateProducerRate,
  validateReplicationFactor,
  validateRetentionBytes,
} from './kafkaRoleValidation'

// Per-role config field groups for the kafka/producer/consumer Inspector
// roles (feature 010, FR-001/FR-002). Split out of Inspector.tsx to keep
// that file under the contributor-legibility line budget (constitution
// Principle VI) — each component owns only its own role's fields and
// draft-text/error local state, following 008's SimRoleFields pattern
// (validate on change, reject inline with a specific message, never clamp,
// keep the last valid value). All three remount cleanly on node change
// because Inspector.tsx renders the whole node branch with `key={node.id}`.

type KafkaSimRole = Extract<SimRole, { role: 'kafka' }>
type ProducerSimRole = Extract<SimRole, { role: 'producer' }>
type ConsumerSimRole = Extract<SimRole, { role: 'consumer' }>

const KAFKA_COMPRESSIONS: KafkaCompression[] = ['none', 'zstd']

type KafkaRoleConfigFieldsProps = {
  sim: KafkaSimRole
  disabled: boolean
  onChange: (sim: KafkaSimRole) => void
}

export function KafkaRoleConfigFields({ sim, disabled, onChange }: KafkaRoleConfigFieldsProps) {
  const [partitionsText, setPartitionsText] = useState(String(sim.partitions))
  const [partitionsError, setPartitionsError] = useState<string | undefined>(undefined)
  const [replicationText, setReplicationText] = useState(String(sim.replicationFactor))
  const [replicationError, setReplicationError] = useState<string | undefined>(undefined)
  const [retentionText, setRetentionText] = useState(String(sim.retentionBytes))
  const [retentionError, setRetentionError] = useState<string | undefined>(undefined)

  const handlePartitionsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setPartitionsText(text)
    const result = validatePartitions(text)
    if ('error' in result) {
      setPartitionsError(result.error)
      return
    }
    setPartitionsError(undefined)
    onChange({ ...sim, partitions: result.value })
  }

  const handleReplicationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setReplicationText(text)
    const result = validateReplicationFactor(text)
    if ('error' in result) {
      setReplicationError(result.error)
      return
    }
    setReplicationError(undefined)
    onChange({ ...sim, replicationFactor: result.value })
  }

  const handleRetentionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setRetentionText(text)
    const result = validateRetentionBytes(text)
    if ('error' in result) {
      setRetentionError(result.error)
      return
    }
    setRetentionError(undefined)
    onChange({ ...sim, retentionBytes: result.value })
  }

  return (
    <>
      <label className="lab-field">
        <span>Hardware profile</span>
        <select
          value={sim.hardwareProfile}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...sim, hardwareProfile: event.target.value as KafkaSimRole['hardwareProfile'] })
          }
        >
          {Object.values(KAFKA_HARDWARE_PROFILES).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.id} — {profile.vcpu} vCPU, {profile.ramGiB} GiB RAM, {profile.networkMBps} MB/s net,{' '}
              {profile.diskMBps} MB/s disk
            </option>
          ))}
        </select>
      </label>
      <label className="lab-field">
        <span>Partitions</span>
        <input type="number" min={1} step={1} value={partitionsText} onChange={handlePartitionsChange} disabled={disabled} />
      </label>
      {partitionsError ? <div className="lab-warning">{partitionsError}</div> : null}
      <label className="lab-field">
        <span>Replication factor</span>
        <input type="number" min={1} step={1} value={replicationText} onChange={handleReplicationChange} disabled={disabled} />
      </label>
      {replicationError ? <div className="lab-warning">{replicationError}</div> : null}
      <label className="lab-field lab-field-checkbox">
        <input
          type="checkbox"
          checked={sim.tlsEnabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...sim, tlsEnabled: event.target.checked })}
        />
        <span>TLS enabled</span>
      </label>
      <div className="lab-field">
        <span>Compression</span>
        <div className="lab-button-row">
          {KAFKA_COMPRESSIONS.map((codec) => (
            <button
              key={codec}
              type="button"
              disabled={disabled}
              className={`chip ${sim.compression === codec ? 'chip-active' : ''}`}
              onClick={() => onChange({ ...sim, compression: codec })}
            >
              {codec}
            </button>
          ))}
        </div>
      </div>
      <label className="lab-field">
        <span>Retention (bytes)</span>
        <input type="number" min={0} step="any" value={retentionText} onChange={handleRetentionChange} disabled={disabled} />
      </label>
      {retentionError ? <div className="lab-warning">{retentionError}</div> : null}
    </>
  )
}

type ProducerRoleConfigFieldsProps = {
  sim: ProducerSimRole
  disabled: boolean
  onChange: (sim: ProducerSimRole) => void
}

export function ProducerRoleConfigFields({ sim, disabled, onChange }: ProducerRoleConfigFieldsProps) {
  const [rateText, setRateText] = useState(String(sim.messageRatePerSec))
  const [rateError, setRateError] = useState<string | undefined>(undefined)
  const [payloadText, setPayloadText] = useState(String(sim.averagePayloadBytes))
  const [payloadError, setPayloadError] = useState<string | undefined>(undefined)

  const handleRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setRateText(text)
    const result = validateProducerRate(text)
    if ('error' in result) {
      setRateError(result.error)
      return
    }
    setRateError(undefined)
    onChange({ ...sim, messageRatePerSec: result.value })
  }

  const handlePayloadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setPayloadText(text)
    const result = validateAveragePayloadBytes(text)
    if ('error' in result) {
      setPayloadError(result.error)
      return
    }
    setPayloadError(undefined)
    onChange({ ...sim, averagePayloadBytes: result.value })
  }

  return (
    <>
      <label className="lab-field">
        <span>Message rate (msg/s)</span>
        <input type="number" min={0} step="any" value={rateText} onChange={handleRateChange} disabled={disabled} />
      </label>
      {rateError ? <div className="lab-warning">{rateError}</div> : null}
      <label className="lab-field">
        <span>Average payload size (bytes)</span>
        <input type="number" min={0} step="any" value={payloadText} onChange={handlePayloadChange} disabled={disabled} />
      </label>
      {payloadError ? <div className="lab-warning">{payloadError}</div> : null}
    </>
  )
}

type ConsumerRoleConfigFieldsProps = {
  sim: ConsumerSimRole
  disabled: boolean
  onChange: (sim: ConsumerSimRole) => void
}

export function ConsumerRoleConfigFields({ sim, disabled, onChange }: ConsumerRoleConfigFieldsProps) {
  const [rateText, setRateText] = useState(String(sim.consumeRatePerSec))
  const [rateError, setRateError] = useState<string | undefined>(undefined)

  const handleRateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value
    setRateText(text)
    const result = validateConsumeRate(text)
    if ('error' in result) {
      setRateError(result.error)
      return
    }
    setRateError(undefined)
    onChange({ ...sim, consumeRatePerSec: result.value })
  }

  return (
    <>
      <label className="lab-field">
        <span>Consume rate (msg/s)</span>
        <input type="number" min={0} step="any" value={rateText} onChange={handleRateChange} disabled={disabled} />
      </label>
      {rateError ? <div className="lab-warning">{rateError}</div> : null}
    </>
  )
}
