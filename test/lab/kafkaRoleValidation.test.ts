import { describe, expect, it } from 'vitest'
import {
  validateAveragePayloadBytes,
  validateConsumeRate,
  validatePartitions,
  validateProducerRate,
  validateReplicationFactor,
  validateRetentionBytes,
} from '../../src/lab/kafkaRoleValidation'

describe('validatePartitions', () => {
  it('accepts whole numbers >= 1', () => {
    expect(validatePartitions('1')).toEqual({ value: 1 })
    expect(validatePartitions('12')).toEqual({ value: 12 })
  })

  it('rejects zero, negatives, non-integers, and blank/non-numeric text', () => {
    expect(validatePartitions('0')).toHaveProperty('error')
    expect(validatePartitions('-1')).toHaveProperty('error')
    expect(validatePartitions('1.5')).toHaveProperty('error')
    expect(validatePartitions('')).toHaveProperty('error')
    expect(validatePartitions('abc')).toHaveProperty('error')
  })
})

describe('validateReplicationFactor', () => {
  it('accepts whole numbers >= 1', () => {
    expect(validateReplicationFactor('3')).toEqual({ value: 3 })
  })

  it('rejects zero, negatives, non-integers, and blank/non-numeric text', () => {
    expect(validateReplicationFactor('0')).toHaveProperty('error')
    expect(validateReplicationFactor('-2')).toHaveProperty('error')
    expect(validateReplicationFactor('2.5')).toHaveProperty('error')
    expect(validateReplicationFactor('')).toHaveProperty('error')
    expect(validateReplicationFactor('abc')).toHaveProperty('error')
  })
})

describe('validateRetentionBytes', () => {
  it('accepts numbers >= 0, including zero and fractional values', () => {
    expect(validateRetentionBytes('0')).toEqual({ value: 0 })
    expect(validateRetentionBytes('1073741824')).toEqual({ value: 1073741824 })
  })

  it('rejects negatives and blank/non-numeric text', () => {
    expect(validateRetentionBytes('-1')).toHaveProperty('error')
    expect(validateRetentionBytes('')).toHaveProperty('error')
    expect(validateRetentionBytes('abc')).toHaveProperty('error')
  })
})

describe('validateProducerRate', () => {
  it('accepts numbers >= 0', () => {
    expect(validateProducerRate('0')).toEqual({ value: 0 })
    expect(validateProducerRate('1000')).toEqual({ value: 1000 })
  })

  it('rejects negatives and blank/non-numeric text', () => {
    expect(validateProducerRate('-1')).toHaveProperty('error')
    expect(validateProducerRate('')).toHaveProperty('error')
    expect(validateProducerRate('abc')).toHaveProperty('error')
  })
})

describe('validateAveragePayloadBytes', () => {
  it('accepts numbers > 0', () => {
    expect(validateAveragePayloadBytes('1024')).toEqual({ value: 1024 })
  })

  it('rejects zero, negatives, and blank/non-numeric text', () => {
    expect(validateAveragePayloadBytes('0')).toHaveProperty('error')
    expect(validateAveragePayloadBytes('-1')).toHaveProperty('error')
    expect(validateAveragePayloadBytes('')).toHaveProperty('error')
    expect(validateAveragePayloadBytes('abc')).toHaveProperty('error')
  })
})

describe('validateConsumeRate', () => {
  it('accepts numbers >= 0', () => {
    expect(validateConsumeRate('0')).toEqual({ value: 0 })
    expect(validateConsumeRate('500')).toEqual({ value: 500 })
  })

  it('rejects negatives and blank/non-numeric text', () => {
    expect(validateConsumeRate('-1')).toHaveProperty('error')
    expect(validateConsumeRate('')).toHaveProperty('error')
    expect(validateConsumeRate('abc')).toHaveProperty('error')
  })
})
