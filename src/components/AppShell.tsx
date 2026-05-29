import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Role = 'gm' | 'player'

/**
 * The app frame both roles share: a worn top bar with the brand and a role chip,
 * a slot for role-specific toolbar controls, and the workspace below.
 * Canvas, fog, pins and the like mount into `children` in later milestones.
 */
export function AppShell({
  role,
  toolbar,
  children,
}: {
  role: Role
  toolbar?: ReactNode
  children: ReactNode
}) {
  const chip =
    role === 'gm'
      ? 'border-[#7a5a2c] bg-ochre/10 text-gold'
      : 'border-teal-dim bg-teal/10 text-teal'

  return (
    <div className="fixed inset-0 flex flex-col">
      <header className="z-20 flex min-h-[54px] flex-none flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-gradient-to-b from-[#2c2016] to-panel px-3.5 py-2 shadow-[0_2px_0_rgba(0,0,0,.3)]">
        <Link to="/" className="mr-1 flex flex-col leading-none whitespace-nowrap">
          <span className="font-display text-[18px] font-extrabold tracking-[0.01em] text-bone">
            The Stranded
          </span>
          <span className="mt-[3px] font-ui text-[9.5px] uppercase tracking-[0.28em] text-ochre">
            Field Map
          </span>
        </Link>
        <span
          className={`rounded-full border px-2.5 py-1 font-ui text-[10px] uppercase tracking-[0.16em] ${chip}`}
        >
          {role === 'gm' ? 'GM' : 'Player'}
        </span>

        {toolbar}
      </header>

      <div className="relative flex min-h-0 flex-1">{children}</div>
    </div>
  )
}
