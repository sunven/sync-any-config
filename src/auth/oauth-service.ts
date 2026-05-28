import type { User } from '@supabase/supabase-js'
import { getAuthRedirectUrl, hasBrowserPkceVerifier, hasSupabaseConfig, supabase } from './supabase-client'

export const missingSupabaseConfigMessage = import.meta.env.DEV
  ? '缺少 Supabase 配置，请检查 .env.local'
  : '缺少 Supabase 构建配置，请检查发布环境变量 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY'

export async function signInWithGoogle() {
  if (!supabase) {
    throw new Error(missingSupabaseConfigMessage)
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    throw error
  }
  if (!data.url) {
    throw new Error('没有收到 Google 登录地址')
  }
  const hasVerifier = hasBrowserPkceVerifier()
  if (hasVerifier === false) {
    throw new Error('浏览器没有保存 PKCE 登录状态。请确认没有禁用 localStorage，并从 http://localhost:1420/ 重新发起登录。')
  }
  return data.url
}

export async function handleOAuthCallback(url: string) {
  if (!supabase) {
    throw new Error(missingSupabaseConfigMessage)
  }

  const parsed = new URL(url)
  const errorDescription = parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error')
  if (errorDescription) {
    throw new Error(errorDescription)
  }

  const code = parsed.searchParams.get('code')
  if (!code) {
    return null
  }

  const hasVerifier = hasBrowserPkceVerifier()
  if (hasVerifier === false) {
    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) {
      return sessionData.session
    }
    throw new Error(`当前页面没有 PKCE 登录状态。请从 ${parsed.origin === 'null' ? '同一个浏览器地址' : parsed.origin} 重新点击 Google 登录，不要手动打开回调 URL。`)
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    throw error
  }
  return data.session
}

export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) {
    return null
  }

  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function signOut() {
  if (!supabase) {
    return
  }
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export { hasSupabaseConfig, supabase }
