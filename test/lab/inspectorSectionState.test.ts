import { beforeEach, describe, expect, it } from 'vitest'
import {
  isSectionOpen,
  resetSectionOpenState,
  setSectionOpen,
} from '../../src/lab/inspectorSectionState'

describe('inspectorSectionState', () => {
  beforeEach(() => {
    resetSectionOpenState()
  })

  it('follows the provided default while the user has not toggled', () => {
    expect(isSectionOpen('node-role-capability', true)).toBe(true)
    expect(isSectionOpen('node-role-capability', false)).toBe(false)
  })

  it('a user toggle sticks and overrides any later default', () => {
    setSectionOpen('node-telemetry', true)
    expect(isSectionOpen('node-telemetry', false)).toBe(true)
    setSectionOpen('node-telemetry', false)
    expect(isSectionOpen('node-telemetry', true)).toBe(false)
  })

  it('tracks each section independently', () => {
    setSectionOpen('node-scaling', true)
    expect(isSectionOpen('node-scaling', false)).toBe(true)
    expect(isSectionOpen('node-appearance', false)).toBe(false)
  })

  it('reset clears stored toggles back to defaults', () => {
    setSectionOpen('edge-style', false)
    resetSectionOpenState()
    expect(isSectionOpen('edge-style', true)).toBe(true)
  })
})
