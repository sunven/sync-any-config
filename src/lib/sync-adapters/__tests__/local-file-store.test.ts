import { describe, expect, it } from 'vitest'
import { MAX_SYNC_FILE_BYTES } from '@/lib/sync-core/types'
import { atomicWriteTextWithBackup, makeLocalTextFile, readLocalTextFile } from '../local-file-store'

describe('makeLocalTextFile', () => {
  it('returns byte size and hash for valid text', async () => {
    const file = await makeLocalTextFile('/tmp/a.json', 'abc')

    expect(file.byteSize).toBe(3)
    expect(file.hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('rejects files larger than v1 limit', async () => {
    await expect(makeLocalTextFile('/tmp/large.json', 'a'.repeat(MAX_SYNC_FILE_BYTES + 1)))
      .rejects
      .toThrow(/超过/)
  })

  it('uses browser mock storage outside Tauri for read and atomic write', async () => {
    await atomicWriteTextWithBackup('/tmp/browser.json', '{"ok":true}')

    const file = await readLocalTextFile('/tmp/browser.json')

    expect(file.contents).toBe('{"ok":true}')
    expect(file.path).toBe('/tmp/browser.json')
  })
})
