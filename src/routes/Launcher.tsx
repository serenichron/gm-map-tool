import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshButton } from '../components/RefreshButton.tsx'
import { getRecentRooms, removeRecentRoom, type RecentRoom } from '../lib/recent.ts'

/**
 * Entry screen. Run the fog as GM, or join a table with a room code.
 */
export function Launcher() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [recent, setRecent] = useState<RecentRoom[]>(() => getRecentRooms())

  const join = () => {
    const c = code.trim().toUpperCase()
    navigate(c ? `/room?c=${encodeURIComponent(c)}` : '/room')
  }
  const forget = (c: string) => {
    removeRecentRoom(c)
    setRecent(getRecentRooms())
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <div className="fixed right-3 top-3 z-40">
        <RefreshButton />
      </div>
      <div className="relative w-[min(560px,92vw)] overflow-hidden rounded-[18px] border border-line bg-gradient-to-b from-panel-2 to-panel p-10 text-center shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(80% 60% at 50% 0%, rgba(224,169,75,.14), transparent 70%)',
          }}
        />
        <div className="relative">
          <div className="font-ui text-[11px] uppercase tracking-[0.32em] text-ochre/85">
            A game master's screen
          </div>
          <h1 className="mt-2 mb-1.5 font-display text-[42px] font-extrabold leading-none text-bone">
            Worldsmith
          </h1>
          <p className="mb-7 text-base leading-relaxed text-bone-dim">
            Run the fog from the GM screen. Players join with a code and watch the
            dust clear only when you let it.
          </p>

          <button
            onClick={() => navigate('/gm')}
            className="inline-flex w-full max-w-[280px] items-center justify-center gap-2 rounded-xl border border-ochre bg-gradient-to-b from-[#3a2a18] to-[#2a1f13] px-5 py-3.5 font-ui text-[15px] font-semibold text-bone transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(200,146,61,.25)]"
          >
            Open GM screen
          </button>

          <div className="mx-auto my-6 flex max-w-[320px] items-center gap-3 text-bone-dim/60">
            <span className="h-px flex-1 bg-line" />
            <span className="font-ui text-[11px] uppercase tracking-[0.2em]">or join a table</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="mx-auto flex max-w-[320px] gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ROOM CODE"
              maxLength={8}
              className="min-w-0 flex-1 rounded-xl border border-teal-dim bg-[#0f0b06] px-4 py-3.5 text-center font-ui text-[15px] font-bold uppercase tracking-[0.25em] text-teal outline-none placeholder:tracking-[0.15em] placeholder:text-bone-dim/50 focus:border-teal"
            />
            <button
              onClick={join}
              className="rounded-xl border border-teal bg-gradient-to-b from-[#15302e] to-[#0f2422] px-5 font-ui text-[15px] font-semibold text-bone transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(62,142,137,.25)]"
            >
              Join
            </button>
          </div>

          {recent.length > 0 && (
            <div className="mx-auto mt-4 max-w-[320px] text-left">
              <div className="mb-1.5 font-ui text-[10px] uppercase tracking-[0.2em] text-bone-dim">
                Recently joined
              </div>
              <div className="flex flex-col gap-1.5">
                {recent.map((r) => (
                  <div
                    key={r.code}
                    className="group flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 transition hover:border-teal-dim"
                  >
                    <button
                      onClick={() => navigate(`/room?c=${encodeURIComponent(r.code)}`)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-ui text-[13px] text-bone">{r.name}</span>
                      <span className="font-ui text-[12px] font-bold tracking-[0.14em] text-teal">{r.code}</span>
                    </button>
                    <button
                      onClick={() => forget(r.code)}
                      aria-label="Forget"
                      className="flex-none text-bone-dim opacity-0 transition group-hover:opacity-100 hover:text-rust"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 font-ui text-xs leading-relaxed text-bone-dim">
            gud dey, traveller — the map waits beneath the dust.
          </p>
        </div>
      </div>
    </div>
  )
}
