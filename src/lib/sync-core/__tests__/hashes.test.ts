import { describe, expect, it } from 'vitest'
import { sha256Hex, utf8ByteSize } from '../hashes'

describe('hashes', () => {
  it('calculates sha256 hex for text', async () => {
    await expect(sha256Hex('abc')).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('calculates UTF-8 byte size', () => {
    expect(utf8ByteSize('abc')).toBe(3)
    expect(utf8ByteSize('中文')).toBe(6)
  })
})
