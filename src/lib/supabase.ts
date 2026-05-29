import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Dormant until milestone 6. We define the client now so the wiring point exists,
 * but nothing in milestones 1–5 imports it — the app runs entirely on the local
 * transport first. When the env vars are present, this returns a real client;
 * otherwise null, so the app never crashes for lack of a backend.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const hasSupabase = supabase !== null
