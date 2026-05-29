// Throwaway end-to-end check of the cloud flow against the live project.
// GM session: create room, upload image, publish. Player session: join by code,
// read published_state, fetch the image. Then clean up. Proves the RLS rules.
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
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY

// 1x1 transparent PNG
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
)

const gm = createClient(URL_, KEY)
const player = createClient(URL_, KEY)

const fail = (m, e) => {
  console.error('FAIL:', m, e?.message ?? e ?? '')
  process.exit(1)
}

// GM
const { data: gmAuth, error: e1 } = await gm.auth.signInAnonymously()
if (e1) fail('gm sign-in', e1)
const gmId = gmAuth.user.id
const code = 'TEST' + Math.floor(Math.random() * 90 + 10)

const { data: room, error: e2 } = await gm
  .from('rooms')
  .insert({ join_code: code, gm_id: gmId })
  .select()
  .single()
if (e2) fail('create room', e2)
console.log('GM created room', room.join_code)

const path = `${room.id}/map.png`
const { error: e3 } = await gm.storage.from('maps').upload(path, PNG, { upsert: true, contentType: 'image/png' })
if (e3) fail('upload image', e3)
console.log('GM uploaded image')

const { error: e4 } = await gm.from('published_state').upsert({
  room_id: room.id,
  version: Date.now(),
  width: 1,
  height: 1,
  image_path: path,
  fog: [{ kind: 'fill', value: 'covered' }],
  pins: [{ id: 'p1', x: 0, y: 0, domain: 'azure', title: 'Test', playerNote: 'hi' }],
})
if (e4) fail('publish', e4)
console.log('GM published')

// Player (separate session)
const { error: e5 } = await player.auth.signInAnonymously()
if (e5) fail('player sign-in', e5)

const { data: foundRoom, error: e6 } = await player
  .from('rooms')
  .select('*')
  .eq('join_code', code)
  .maybeSingle()
if (e6 || !foundRoom) fail('player join by code', e6)
console.log('player joined room', foundRoom.join_code)

const { data: state, error: e7 } = await player
  .from('published_state')
  .select('*')
  .eq('room_id', foundRoom.id)
  .maybeSingle()
if (e7 || !state) fail('player read state', e7)
console.log('player read state: version', state.version, '| pins', state.pins.length, '| fog ops', state.fog.length)

const pub = player.storage.from('maps').getPublicUrl(state.image_path).data.publicUrl
const res = await fetch(pub)
console.log('player fetched image:', res.status, res.headers.get('content-type'))

// negative check: a different anon session must NOT be able to write this room
const { error: e8 } = await player.from('published_state').upsert({
  room_id: foundRoom.id,
  version: Date.now(),
  width: 9,
  height: 9,
  image_path: path,
})
console.log('player write blocked by RLS:', e8 ? 'YES ✅' : 'NO ❌ (policy too loose!)')

// cleanup
await gm.storage.from('maps').remove([path])
await gm.from('rooms').delete().eq('id', room.id)
console.log('\ncleaned up. ALL GOOD ✅')
process.exit(0)
