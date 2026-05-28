import { describe, expect, it } from 'vitest'
import { CONFIG_PRESETS, detectPresetPlatform, expandPresetPath, presetPathForPlatform } from '../presets'

describe('config presets', () => {
  it('uses stable canonical keys', () => {
    expect(CONFIG_PRESETS.map(preset => preset.key)).toContain('preset:claude:desktop-config')
    expect(new Set(CONFIG_PRESETS.map(preset => preset.key)).size).toBe(CONFIG_PRESETS.length)
  })

  it('detects platform from navigator platform values', () => {
    expect(detectPresetPlatform('MacIntel')).toBe('macos')
    expect(detectPresetPlatform('Win32')).toBe('windows')
    expect(detectPresetPlatform('Linux x86_64')).toBe('linux')
  })

  it('expands home and windows env placeholders', () => {
    expect(expandPresetPath('~/.codex/config.toml', { HOME: '/Users/a' })).toBe('/Users/a/.codex/config.toml')
    expect(expandPresetPath('%APPDATA%\\Cursor\\User\\settings.json', { APPDATA: 'C:\\Users\\a\\AppData\\Roaming' }))
      .toBe('C:\\Users\\a\\AppData\\Roaming\\Cursor\\User\\settings.json')
  })

  it('returns a platform-specific path for presets', () => {
    const preset = CONFIG_PRESETS.find(item => item.key === 'preset:codex:config')
    expect(preset).toBeDefined()
    expect(presetPathForPlatform(preset!, 'macos', { HOME: '/Users/a' })).toBe('/Users/a/.codex/config.toml')
  })
})
