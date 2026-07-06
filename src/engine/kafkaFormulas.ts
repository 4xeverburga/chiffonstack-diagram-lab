import type { FormulaDescriptor, FormulaSource, KafkaCompression } from './ports'
import type { KafkaHardwareProfile } from './kafkaCatalog'
import {
  KAFKA_BYTES_PER_GIB,
  KAFKA_BYTES_PER_MB,
  KAFKA_CPU_MBPS_PER_VCPU,
  KAFKA_DISK_CLIFF_READ_FACTOR,
  KAFKA_PAGE_CACHE_OVERHEAD_GIB,
  KAFKA_STATUS_SATURATION_THRESHOLD,
  KAFKA_TLS_CPU_MULTIPLIER,
  KAFKA_ZSTD_CPU_MULTIPLIER,
} from './config'

export const BYTES_PER_MB = KAFKA_BYTES_PER_MB
export const BYTES_PER_GIB = KAFKA_BYTES_PER_GIB

const SOURCE_CAPACITY_MODEL: FormulaSource = {
  title: 'Kafka capacity planning model',
  url: 'https://www.confluent.io/blog/how-choose-number-topics-partitions-kafka-cluster/',
  note: 'Single-cluster abstraction: ingress is constrained by network, CPU and disk ceilings.',
}

const SOURCE_TLS: FormulaSource = {
  title: 'Kafka SSL/TLS overhead',
  url: 'https://docs.confluent.io/platform/current/security/security_tutorial.html',
  note: 'TLS increases per-byte CPU cost.',
}

const SOURCE_ZSTD: FormulaSource = {
  title: 'Kafka compression tradeoffs',
  url: 'https://kafka.apache.org/documentation/#producerconfigs_compression.type',
  note: 'zstd improves wire efficiency but increases CPU work.',
}

const SOURCE_PAGE_CACHE: FormulaSource = {
  title: 'Kafka and Linux page cache behavior',
  url: 'https://kafka.apache.org/documentation/#design_filesystem',
  note: 'Reads are fast while lagged data remains in page cache.',
}

const SOURCE_DISK_CLIFF: FormulaSource = {
  title: 'Kafka consumer lag and disk read cliff',
  url: 'https://www.confluent.io/blog/kafka-fastest-messaging-system/',
  note: 'Falling out of cache abruptly drops read throughput to disk speed.',
}

export function producerIngressMBps(messageRatePerSec: number, averagePayloadBytes: number): number {
  if (messageRatePerSec <= 0 || averagePayloadBytes <= 0) return 0
  return (messageRatePerSec * averagePayloadBytes) / BYTES_PER_MB
}

export function networkIngressCeilingMBps(profile: KafkaHardwareProfile, replicationFactor: number): number {
  const rf = Math.max(1, replicationFactor)
  return profile.networkMBps / rf
}

export function cpuIngressCeilingMBps(
  profile: KafkaHardwareProfile,
  tlsEnabled: boolean,
  compression: KafkaCompression,
  partitions: number,
): number {
  const partitionPenalty = 1 + Math.max(0, partitions - 1) * 0.001
  const tlsMultiplier = tlsEnabled ? KAFKA_TLS_CPU_MULTIPLIER : 1
  const compressionMultiplier = compression === 'zstd' ? KAFKA_ZSTD_CPU_MULTIPLIER : 1
  const multiplier = partitionPenalty * tlsMultiplier * compressionMultiplier
  return (profile.vcpu * KAFKA_CPU_MBPS_PER_VCPU) / multiplier
}

export function diskIngressCeilingMBps(profile: KafkaHardwareProfile): number {
  return profile.diskMBps
}

export function saturationRatio(offeredMBps: number, ceilingMBps: number): number {
  if (ceilingMBps <= 0) return offeredMBps > 0 ? Number.POSITIVE_INFINITY : 0
  return offeredMBps / ceilingMBps
}

export function pageCacheCapacityBytes(profile: KafkaHardwareProfile): number {
  const cacheGiB = Math.max(0, profile.ramGiB - KAFKA_PAGE_CACHE_OVERHEAD_GIB)
  return cacheGiB * BYTES_PER_GIB
}

export function diskCliffActive(lagBytes: number, cacheCapacityBytes: number): boolean {
  return lagBytes > cacheCapacityBytes
}

export function pageCacheHitRatio(lagBytes: number, cacheCapacityBytes: number): number {
  if (!diskCliffActive(lagBytes, cacheCapacityBytes)) return 1
  return 0.15
}

export function diskCliffReadCeilingMBps(profile: KafkaHardwareProfile): number {
  return profile.diskMBps * KAFKA_DISK_CLIFF_READ_FACTOR
}

export function deriveKafkaStatus(
  diskCliff: boolean,
  networkSaturation: number,
  cpuSaturation: number,
  diskSaturation: number,
): 'healthy' | 'saturated' | 'degraded' {
  if (diskCliff) return 'degraded'
  if (
    networkSaturation >= KAFKA_STATUS_SATURATION_THRESHOLD ||
    cpuSaturation >= KAFKA_STATUS_SATURATION_THRESHOLD ||
    diskSaturation >= KAFKA_STATUS_SATURATION_THRESHOLD
  ) {
    return 'saturated'
  }
  return 'healthy'
}

export function buildKafkaFormulaDescriptors(input: {
  offeredIngressMBps: number
  networkCeilingMBps: number
  cpuCeilingMBps: number
  diskCeilingMBps: number
  lagBytes: number
  cacheCapacityBytes: number
  diskCliff: boolean
  profile: KafkaHardwareProfile
  tlsEnabled: boolean
  compression: KafkaCompression
  partitions: number
  replicationFactor: number
}): FormulaDescriptor[] {
  const bottleneckCeiling = Math.min(input.networkCeilingMBps, input.cpuCeilingMBps, input.diskCeilingMBps)
  const saturationBinding = input.offeredIngressMBps > bottleneckCeiling

  return [
    {
      id: 'kafka.network.ingress-ceiling',
      name: 'Network ingress ceiling',
      expression: 'networkIngressCeilingMBps = profile.networkMBps / replicationFactor',
      inputs: {
        profileNetworkMBps: input.profile.networkMBps,
        replicationFactor: input.replicationFactor,
      },
      sources: [SOURCE_CAPACITY_MODEL, ...input.profile.sources.networkMBps],
      isBinding: saturationBinding && bottleneckCeiling === input.networkCeilingMBps,
    },
    {
      id: 'kafka.cpu.ingress-ceiling',
      name: 'CPU ingress ceiling',
      expression: 'cpuIngressCeilingMBps = (vcpu * cpuPerVcpuMBps) / (partitionPenalty * tlsMultiplier * compressionMultiplier)',
      inputs: {
        vcpu: input.profile.vcpu,
        cpuPerVcpuMBps: KAFKA_CPU_MBPS_PER_VCPU,
        partitions: input.partitions,
        tlsEnabled: input.tlsEnabled,
        compression: input.compression,
      },
      sources: [SOURCE_CAPACITY_MODEL, SOURCE_TLS, SOURCE_ZSTD, ...input.profile.sources.vcpu],
      isBinding: saturationBinding && bottleneckCeiling === input.cpuCeilingMBps,
    },
    {
      id: 'kafka.disk.ingress-ceiling',
      name: 'Disk ingress ceiling',
      expression: 'diskIngressCeilingMBps = profile.diskMBps',
      inputs: {
        profileDiskMBps: input.profile.diskMBps,
      },
      sources: [SOURCE_CAPACITY_MODEL, ...input.profile.sources.diskMBps],
      isBinding: saturationBinding && bottleneckCeiling === input.diskCeilingMBps,
    },
    {
      id: 'kafka.disk-cliff.threshold',
      name: 'Disk cliff threshold',
      expression: 'diskCliff = lagBytes > max(0, (profile.ramGiB - overheadGiB)) * GiB',
      inputs: {
        lagBytes: input.lagBytes,
        cacheCapacityBytes: input.cacheCapacityBytes,
        profileRamGiB: input.profile.ramGiB,
        overheadGiB: KAFKA_PAGE_CACHE_OVERHEAD_GIB,
      },
      sources: [SOURCE_PAGE_CACHE, ...input.profile.sources.ramGiB],
      isBinding: input.diskCliff,
    },
    {
      id: 'kafka.disk-cliff.read-ceiling',
      name: 'Disk cliff read ceiling',
      expression: 'diskCliffReadCeilingMBps = profile.diskMBps * diskCliffReadFactor',
      inputs: {
        profileDiskMBps: input.profile.diskMBps,
        diskCliffReadFactor: KAFKA_DISK_CLIFF_READ_FACTOR,
      },
      sources: [SOURCE_DISK_CLIFF, ...input.profile.sources.diskMBps],
      isBinding: input.diskCliff,
    },
  ]
}

// Structural gate for SC-003: every shipped formula descriptor must carry at
// least one source citation.
export function validateFormulaDescriptorsHaveSources(descriptors: FormulaDescriptor[]): void {
  for (const descriptor of descriptors) {
    if (descriptor.sources.length === 0) {
      throw new Error(`Kafka formula "${descriptor.id}" has no source citation.`)
    }
  }
}
