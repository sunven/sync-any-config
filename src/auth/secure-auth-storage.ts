import { invoke, isTauri } from '@tauri-apps/api/core'

const memoryStore = new Map<string, string>()

function localStorageKey(key: string) {
  return `secure:${key}`
}

export async function secureStorageGet(key: string): Promise<string | null> {
  if (isTauri()) {
    return invoke<string | null>('secure_storage_get', { key })
  }

  try {
    return localStorage.getItem(localStorageKey(key))
  }
  catch {
    return memoryStore.get(key) ?? null
  }
}

export async function secureStorageSet(key: string, value: string): Promise<void> {
  if (isTauri()) {
    await invoke('secure_storage_set', { key, value })
    return
  }

  try {
    localStorage.setItem(localStorageKey(key), value)
  }
  catch {
    memoryStore.set(key, value)
  }
}

export async function secureStorageRemove(key: string): Promise<void> {
  if (isTauri()) {
    await invoke('secure_storage_remove', { key })
    return
  }

  try {
    localStorage.removeItem(localStorageKey(key))
  }
  catch {
    memoryStore.delete(key)
  }
}
