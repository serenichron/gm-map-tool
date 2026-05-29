import { useState } from 'react'
import { signInGm, signUpGm } from '../lib/auth.ts'

/**
 * GM sign-in / account creation. On success the auth state changes and the
 * parent (GMScreen) swaps in the workspace.
 */
export function GmLogin() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Enter a username and password.')
      return
    }
    setBusy(true)
    setError(null)
    const res = mode === 'in' ? await signInGm(username, password) : await signUpGm(username, password)
    setBusy(false)
    if (res.error) setError(res.error)
    // success: onAuthStateChange in GMScreen takes over
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <div className="w-[min(380px,92vw)] rounded-[18px] border border-line bg-gradient-to-b from-panel-2 to-panel p-8 text-center shadow-2xl">
        <div className="font-ui text-[11px] uppercase tracking-[0.32em] text-ochre/85">Worldsmith</div>
        <h1 className="mt-2 mb-5 font-display text-[26px] font-extrabold text-bone">
          {mode === 'in' ? 'Keeper, sign in' : 'New Keeper'}
        </h1>

        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setError(null)
          }}
          placeholder="Username"
          autoCapitalize="none"
          autoCorrect="off"
          className="mb-2 w-full rounded-xl border border-line bg-[#0f0b06] px-4 py-3 font-ui text-[15px] text-bone outline-none focus:border-ochre"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Password"
          className="w-full rounded-xl border border-line bg-[#0f0b06] px-4 py-3 font-ui text-[15px] text-bone outline-none focus:border-ochre"
        />

        {error && <p className="mt-2 font-ui text-[12px] text-rust">{error}</p>}

        <button
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-xl border border-ochre bg-gradient-to-b from-[#3a2a18] to-[#2a1f13] px-5 py-3 font-ui text-[15px] font-semibold text-bone transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>

        <button
          onClick={() => {
            setMode((m) => (m === 'in' ? 'up' : 'in'))
            setError(null)
          }}
          className="mt-4 font-ui text-[12px] text-bone-dim underline hover:text-bone"
        >
          {mode === 'in' ? 'Create an account' : 'I already have an account'}
        </button>
      </div>
    </div>
  )
}
