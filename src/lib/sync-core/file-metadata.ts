export function basenameFromPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : path
}

export function formatFromPath(path: string): string | null {
  const name = basenameFromPath(path)
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase()
  return extension || null
}
