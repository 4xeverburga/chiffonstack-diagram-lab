import type { FormulaDescriptor } from '../engine/ports'

// Derives which physical resource is currently the binding constraint from
// a Kafka node's FormulaDescriptor[] (feature 009's real contract has no
// dedicated `bindingConstraint` field on KafkaNodeMetrics — binding is
// expressed per-formula via `isBinding`, see specs/009-kafka-simulation-model/
// contracts/engine-kafka-ports.md and src/engine/kafka/formulas.ts's
// `buildKafkaFormulaDescriptors`). This is the single function both the
// Inspector's metrics readout and FormulaPanel call, so their highlights
// always agree (FR-005) by construction.
export type BindingResource = 'network' | 'cpu' | 'disk' | undefined

const DISK_CLIFF_ID_PREFIX = 'kafka.disk-cliff.'
const RESOURCE_BY_INGRESS_CEILING_ID: Record<string, BindingResource> = {
  'kafka.network.ingress-ceiling': 'network',
  'kafka.cpu.ingress-ceiling': 'cpu',
  'kafka.disk.ingress-ceiling': 'disk',
}

export function deriveBindingResource(formulaDescriptors: FormulaDescriptor[] | undefined): BindingResource {
  if (!formulaDescriptors || formulaDescriptors.length === 0) return undefined

  const diskCliffBinding = formulaDescriptors.some(
    (descriptor) => descriptor.id.startsWith(DISK_CLIFF_ID_PREFIX) && descriptor.isBinding,
  )
  if (diskCliffBinding) return 'disk'

  for (const descriptor of formulaDescriptors) {
    if (!descriptor.isBinding) continue
    const resource = RESOURCE_BY_INGRESS_CEILING_ID[descriptor.id]
    if (resource) return resource
  }

  return undefined
}
