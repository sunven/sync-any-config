export type PresetPlatform = 'macos' | 'windows' | 'linux'

export interface ConfigPreset {
  key: string
  label: string
  description: string
  fileName: string
  format: string
  paths: Record<PresetPlatform, string>
}

export interface PresetPathEnv {
  HOME?: string
  APPDATA?: string
  USERPROFILE?: string
}

export const CONFIG_PRESETS: ConfigPreset[] = [
  {
    key: 'preset:claude:desktop-config',
    label: 'Claude Desktop',
    description: 'MCP servers and Claude Desktop app settings.',
    fileName: 'claude_desktop_config.json',
    format: 'json',
    paths: {
      macos: '~/Library/Application Support/Claude/claude_desktop_config.json',
      windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
      linux: '~/.config/Claude/claude_desktop_config.json',
    },
  },
  {
    key: 'preset:cursor:user-settings',
    label: 'Cursor Settings',
    description: 'Cursor user settings JSON.',
    fileName: 'settings.json',
    format: 'json',
    paths: {
      macos: '~/Library/Application Support/Cursor/User/settings.json',
      windows: '%APPDATA%\\Cursor\\User\\settings.json',
      linux: '~/.config/Cursor/User/settings.json',
    },
  },
  {
    key: 'preset:codex:config',
    label: 'Codex Config',
    description: 'Codex CLI configuration.',
    fileName: 'config.toml',
    format: 'toml',
    paths: {
      macos: '~/.codex/config.toml',
      windows: '%USERPROFILE%\\.codex\\config.toml',
      linux: '~/.codex/config.toml',
    },
  },
  {
    key: 'preset:claude-code:settings',
    label: 'Claude Code Settings',
    description: 'Claude Code local settings.',
    fileName: 'settings.json',
    format: 'json',
    paths: {
      macos: '~/.claude/settings.json',
      windows: '%USERPROFILE%\\.claude\\settings.json',
      linux: '~/.claude/settings.json',
    },
  },
  {
    key: 'preset:mcp:servers',
    label: 'MCP Servers',
    description: 'Shared MCP server configuration.',
    fileName: 'mcp.json',
    format: 'json',
    paths: {
      macos: '~/.config/mcp/mcp.json',
      windows: '%APPDATA%\\mcp\\mcp.json',
      linux: '~/.config/mcp/mcp.json',
    },
  },
]

export function detectPresetPlatform(platformValue: string): PresetPlatform {
  const value = platformValue.toLowerCase()
  if (value.includes('win')) {
    return 'windows'
  }
  if (value.includes('linux')) {
    return 'linux'
  }
  return 'macos'
}

export function expandPresetPath(template: string, env: PresetPathEnv): string {
  let path = template

  if (path.startsWith('~/')) {
    path = `${env.HOME ?? '~'}${path.slice(1)}`
  }

  return path
    .replace(/%APPDATA%/g, env.APPDATA ?? '%APPDATA%')
    .replace(/%USERPROFILE%/g, env.USERPROFILE ?? '%USERPROFILE%')
}

export function presetPathForPlatform(preset: ConfigPreset, platform: PresetPlatform, env: PresetPathEnv) {
  return expandPresetPath(preset.paths[platform], env)
}
