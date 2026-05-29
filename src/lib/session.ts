import { supabase } from './supabase.ts'

/**
 * Ensure there's an anonymous session and return its user id. supabase-js
 * persists the session in localStorage, so a GM keeps the same id across
 * reloads — which is what ties them to the rooms they created. Returns null if
 * Supabase isn't configured (the app then runs on the local backend).
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signed, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('anonymous sign-in failed:', error.message)
    return null
  }
  return signed.user?.id ?? null
}
