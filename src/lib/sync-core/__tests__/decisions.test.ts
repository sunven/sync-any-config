import type { LocalFileState, RemoteHeadResult } from '../types'
import { describe, expect, it } from 'vitest'
import { decideUpload, detectObviousSecrets } from '../decisions'
import { MAX_SYNC_FILE_BYTES } from '../types'

function local(overrides: Partial<LocalFileState> = {}): LocalFileState {
  return {
    fileId: 'file-1',
    watchEnabled: true,
    localHash: 'hash-local',
    lastAppliedRevisionId: 'rev-1',
    hasLocalChanges: true,
    byteSize: 20,
    ...overrides,
  }
}

function remote(overrides: Partial<RemoteHeadResult> = {}): RemoteHeadResult {
  return {
    fileId: 'file-1',
    readOk: true,
    currentRevisionId: 'rev-1',
    ...overrides,
  } as RemoteHeadResult
}

describe('decideUpload', () => {
  it('blocks upload when remote state is unknown', () => {
    expect(decideUpload(local(), { fileId: 'file-1', readOk: false, reason: 'network' }))
      .toEqual({ type: 'blocked', reason: 'cloud_unknown' })
  })

  it('blocks upload when watch is disabled', () => {
    expect(decideUpload(local({ watchEnabled: false }), remote()))
      .toEqual({ type: 'blocked', reason: 'paused' })
  })

  it('blocks upload when file is larger than the v1 limit', () => {
    expect(decideUpload(local({ byteSize: MAX_SYNC_FILE_BYTES + 1 }), remote()))
      .toEqual({ type: 'blocked', reason: 'too_large' })
  })

  it('blocks upload when there are no local changes', () => {
    expect(decideUpload(local({ hasLocalChanges: false }), remote()))
      .toEqual({ type: 'blocked', reason: 'unchanged' })
  })

  it('returns conflict when local base revision does not match remote head', () => {
    expect(decideUpload(local({ lastAppliedRevisionId: 'rev-1' }), remote({ currentRevisionId: 'rev-2' })))
      .toEqual({ type: 'conflict', localBaseRevisionId: 'rev-1', remoteRevisionId: 'rev-2' })
  })

  it('allows upload when local changes are based on remote head', () => {
    expect(decideUpload(local({ lastAppliedRevisionId: 'rev-1' }), remote({ currentRevisionId: 'rev-1' })))
      .toEqual({ type: 'upload', expectedRevisionId: 'rev-1' })
  })
})

describe('detectObviousSecrets', () => {
  it('detects common secret-looking fields', () => {
    const warnings = detectObviousSecrets('apiKey = "sk-1234567890abcdef"\npassword = "long-password"')

    expect(warnings.map(warning => warning.kind)).toEqual(['api_key', 'password'])
  })

  it('does not warn for ordinary config text', () => {
    expect(detectObviousSecrets('theme = "dark"\nwindow = "main"')).toEqual([])
  })
})
