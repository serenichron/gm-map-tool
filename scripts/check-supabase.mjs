// Throwaway connectivity check. Verifies the key works, anonymous sign-ins are
// enabled, and the published_state table exists. Run: node scripts/check-supabase.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const { data: auth, error: authErr } = await supabase.auth.signInAnonymously()
if (authErr) {
  console.error('ANON SIGN-IN FAILED:', authErr.message)
  process.exit(1)
}
console.log('anon sign-in OK, uid:', auth.user?.id)

const { error: selErr } = await supabase.from('published_state').select('room_id').limit(1)
if (selErr) {
  console.error('published_state SELECT FAILED:', selErr.message)
  process.exit(1)
}
console.log('published_state reachable OK')

const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
if (bErr) console.error('storage listBuckets error:', bErr.message)
else console.log('buckets:', buckets.map((b) => b.id).join(', ') || '(none visible)')

console.log('\nALL GOOD ✅')
process.exit(0)
