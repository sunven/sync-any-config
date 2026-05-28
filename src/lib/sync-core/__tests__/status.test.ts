import type { DisplayStatusInput } from '../status'
import { describe, expect, it } from 'vitest'
import { decideDisplayStatus } from '../status'

function input(overrides: Partial<DisplayStatusInput> = {}): DisplayStatusInput {
  return {
    hasOpenConflict: false,
    paused: false,
    watchEnabled: true,
    hasLocalPath: true,
    currentRevisionId: 'rev-1',
    lastAppliedRevisionId: 'rev-1',
    storedLocalHash: 'hash-1',
    observedLocalHash: 'hash-1',
    localReadOk: true,
    ...overrides,
  }
}

describe('decideDisplayStatus', () => {
  it('returns idle when local and remote match the last applied state', () => {
    expect(decideDisplayStatus(input())).toBe('idle')
  })

  it('returns local_changed when only the local file changed', () => {
    expect(decideDisplayStatus(input({ observedLocalHash: 'hash-2' }))).toBe('local_changed')
  })

  it('returns remote_changed when only the remote revision changed', () => {
    expect(decideDisplayStatus(input({ currentRevisionId: 'rev-2' }))).toBe('remote_changed')
  })

  it('returns conflict when local and remote both changed', () => {
    expect(decideDisplayStatus(input({ currentRevisionId: 'rev-2', observedLocalHash: 'hash-2' }))).toBe('conflict')
  })

  it('returns conflict before paused when there is an open conflict', () => {
    expect(decideDisplayStatus(input({ hasOpenConflict: true, watchEnabled: false }))).toBe('conflict')
  })

  it('returns paused when local detection is disabled', () => {
    expect(decideDisplayStatus(input({ watchEnabled: false }))).toBe('paused')
  })

  it('returns unlinked when this device has no local path', () => {
    expect(decideDisplayStatus(input({ hasLocalPath: false, localReadOk: undefined, observedLocalHash: undefined }))).toBe('unlinked')
  })

  it('returns error when the local file cannot be read', () => {
    expect(decideDisplayStatus(input({ localReadOk: false, observedLocalHash: null }))).toBe('error')
  })
})
