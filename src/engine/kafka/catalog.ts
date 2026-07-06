import type { FormulaSource } from '../ports'

export type KafkaHardwareProfileId = 'm6i.large' | 'm6i.xlarge' | 'm6i.2xlarge' | 'm6i.4xlarge'

export interface KafkaHardwareProfile {
  id: KafkaHardwareProfileId
  vcpu: number
  ramGiB: number
  networkMBps: number
  diskMBps: number
  sources: {
    vcpu: FormulaSource[]
    ramGiB: FormulaSource[]
    networkMBps: FormulaSource[]
    diskMBps: FormulaSource[]
  }
}

const AWS_M6I_SOURCE: FormulaSource = {
  title: 'Amazon EC2 M6i instances',
  url: 'https://aws.amazon.com/ec2/instance-types/m6i/',
}

const AWS_EBS_SOURCE: FormulaSource = {
  title: 'Amazon EBS-optimized instances',
  url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-optimized.html',
  note: 'Disk throughput is modeled as an effective broker I/O ceiling.',
}

export const KAFKA_HARDWARE_PROFILES: Record<KafkaHardwareProfileId, KafkaHardwareProfile> = {
  'm6i.large': {
    id: 'm6i.large',
    vcpu: 2,
    ramGiB: 8,
    networkMBps: 1562.5,
    diskMBps: 250,
    sources: {
      vcpu: [AWS_M6I_SOURCE],
      ramGiB: [AWS_M6I_SOURCE],
      networkMBps: [AWS_M6I_SOURCE],
      diskMBps: [AWS_EBS_SOURCE],
    },
  },
  'm6i.xlarge': {
    id: 'm6i.xlarge',
    vcpu: 4,
    ramGiB: 16,
    networkMBps: 1562.5,
    diskMBps: 500,
    sources: {
      vcpu: [AWS_M6I_SOURCE],
      ramGiB: [AWS_M6I_SOURCE],
      networkMBps: [AWS_M6I_SOURCE],
      diskMBps: [AWS_EBS_SOURCE],
    },
  },
  'm6i.2xlarge': {
    id: 'm6i.2xlarge',
    vcpu: 8,
    ramGiB: 32,
    networkMBps: 3125,
    diskMBps: 1000,
    sources: {
      vcpu: [AWS_M6I_SOURCE],
      ramGiB: [AWS_M6I_SOURCE],
      networkMBps: [AWS_M6I_SOURCE],
      diskMBps: [AWS_EBS_SOURCE],
    },
  },
  'm6i.4xlarge': {
    id: 'm6i.4xlarge',
    vcpu: 16,
    ramGiB: 64,
    networkMBps: 6250,
    diskMBps: 2000,
    sources: {
      vcpu: [AWS_M6I_SOURCE],
      ramGiB: [AWS_M6I_SOURCE],
      networkMBps: [AWS_M6I_SOURCE],
      diskMBps: [AWS_EBS_SOURCE],
    },
  },
}

export function resolveKafkaHardwareProfile(profileId: KafkaHardwareProfileId): KafkaHardwareProfile {
  return KAFKA_HARDWARE_PROFILES[profileId]
}
