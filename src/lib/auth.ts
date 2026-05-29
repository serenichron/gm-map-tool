import { supabase } from './supabase.ts'

/**
 * GM accounts use Supabase email/password auth, with the username mapped to a
 * synthetic email. Players stay anonymous; only the GM logs in. A logged-in GM
 * is a session whose user is NOT anonymous.
 *
 * Requires the Supabase project to have email confirmation disabled (Auth →
 * Providers → Email), since these synthetic addresses can't receive mail.
 */

const toEmail = (username: string) =>
  `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@worldsmith.app`

export type AuthResult = { uid?: string; error?: string }

export async function signInGm(username: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'No backend configured.' }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(username),
    password,
  })
  if (error) return { error: error.message }
  return { uid: data.user?.id }
}

export async function signUpGm(username: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'No backend configured.' }
  const { data, error } = await supabase.auth.signUp({
    email: toEmail(username),
    password,
  })
  if (error) return { error: error.message }
  if (!data.session) {
    // no session means email confirmation is still on for this project
    return { error: 'Account made, but sign-in is blocked — disable email confirmation in Supabase.' }
  }
  return { uid: data.user?.id }
}

export async function signOutGm(): Promise<void> {
  await supabase?.auth.signOut()
}

/** Current logged-in GM id, or null (anonymous / signed-out doesn't count). */
export async function currentGmId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  return user && !user.is_anonymous ? user.id : null
}
