import { describe, expect, it } from 'vitest'
import { getDeviceId } from '../device-store'

describe('getDeviceId', () => {
  it('returns and persists a uuid-shaped device id', () => {
    localStorage.clear()

    const first = getDeviceId()
    const second = getDeviceId()

    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
