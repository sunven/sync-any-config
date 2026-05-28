const DEVICE_ID_KEY = 'sync_any_config_device_id'
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

function fallbackUuid() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0F) | 0x40
  bytes[8] = (bytes[8] & 0x3F) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function createDeviceUuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return fallbackUuid()
}

export function getDeviceId() {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY)
    if (stored && UUID_PATTERN.test(stored)) {
      return stored
    }
    const deviceId = createDeviceUuid()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
    return deviceId
  }
  catch {
    return createDeviceUuid()
  }
}

export function getDeviceLabel() {
  if (typeof navigator === 'undefined') {
    return 'Unknown device'
  }
  const platform = navigator.platform || 'desktop'
  return `${platform} device`
}

export function getPlatform() {
  if (typeof navigator === 'undefined') {
    return 'unknown'
  }
  return navigator.platform || 'unknown'
}
