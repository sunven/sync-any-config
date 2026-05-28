import type { SupabaseClientOptions } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import { isTauri } from '@tauri-apps/api/core'
import { secureStorageGet, secureStorageRemove, secureStorageSet } from './secure-auth-storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const isTest = import.meta.env.MODE === 'test'

type AuthStorage = NonNullable<NonNullable<SupabaseClientOptions<'public'>['auth']>['storage']>

const tauriAuthStorage: AuthStorage = {
  async getItem(key) {
    return secureStorageGet(`supabase:${key}`)
  },
  async setItem(key, value) {
    await secureStorageSet(`supabase:${key}`, value)
  },
  async removeItem(key) {
    await secureStorageRemove(`supabase:${key}`)
  },
}

function authOptions(): NonNullable<SupabaseClientOptions<'public'>['auth']> {
  const options: NonNullable<SupabaseClientOptions<'public'>['auth']> = {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'sync-any-config-auth',
  }

  if (isTauri()) {
    options.storage = tauriAuthStorage
  }

  return options
}

export const hasSupabaseConfig = !isTest && Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig && supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: authOptions(),
    })
  : null

export function getAuthRedirectUrl() {
  if (!isTauri() && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  return import.meta.env.VITE_AUTH_REDIRECT_URL || 'sync-any-config://auth/callback'
}

export function hasBrowserPkceVerifier() {
  if (isTauri() || typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem('sync-any-config-auth-code-verifier') !== null
  }
  catch {
    return false
  }
}
