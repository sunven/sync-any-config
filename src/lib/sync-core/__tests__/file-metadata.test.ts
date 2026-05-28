import { describe, expect, it } from 'vitest'
import { basenameFromPath, formatFromPath } from '../file-metadata'

describe('file metadata helpers', () => {
  it('extracts basename from unix and windows paths', () => {
    expect(basenameFromPath('/Users/a/.config/tool/config.toml')).toBe('config.toml')
    expect(basenameFromPath('C:\\Users\\a\\tool\\settings.json')).toBe('settings.json')
  })

  it('extracts lowercase extension when available', () => {
    expect(formatFromPath('/tmp/config.YML')).toBe('yml')
    expect(formatFromPath('/tmp/hosts')).toBeNull()
  })
})
