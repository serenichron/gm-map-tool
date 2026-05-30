import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshButton } from './RefreshButton.tsx'
import { Icon } from './icons.tsx'

type Role = 'gm' | 'player'

const APP_ICON = `${import.meta.env.BASE_URL}icons/icon-64.png`
const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-panel-2 text-bone transition hover:border-[#6a5232] hover:bg-[#352818]'

/**
 * App frame. A slim top row carries identity + session controls (`topRight`);
 * an optional second row (`toolbar`) holds the editing tools. Both rows wrap
 * gracefully on small screens. The workspace fills the rest.
 */
export function AppShell({
  role,
  topRight,
  toolbar,
  onSignOut,
  children,
}: {
  role: Role
  topRight?: ReactNode
  toolbar?: ReactNode
  onSignOut?: () => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  const chip =
    role === 'gm'
      ? 'border-[#7a5a2c] bg-ochre/10 text-gold'
      : 'border-teal-dim bg-teal/10 text-teal'

  return (
    <div className="fixed inset-0 flex flex-col">
      <header className="z-20 flex-none border-b border-line bg-gradient-to-b from-[#2c2016] to-panel shadow-[0_2px_0_rgba(0,0,0,.3)]">
        {/* top row: identity + session */}
        <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
          <button className={iconBtn} onClick={() => navigate('/')} title="Back to start">
            <Icon name="back" />
          </button>
          <Link to="/" className="flex items-center gap-2 whitespace-nowrap">
            <img src={APP_ICON} alt="" className="h-7 w-7 rounded-[7px]" />
            <span className="font-display text-[17px] font-extrabold tracking-[0.01em] text-bone">
              Worldsmith
            </span>
          </Link>
          {role === 'gm' && (
            <span
              className={`rounded-full border px-2 py-0.5 font-ui text-[10px] uppercase tracking-[0.14em] ${chip}`}
            >
              GM
            </span>
          )}

          <div className="flex-1" />

          {topRight}
          {onSignOut && (
            <button className={iconBtn} onClick={onSignOut} title="Sign out">
              <Icon name="logout" />
            </button>
          )}
          <RefreshButton />
        </div>

        {/* tools row (GM editing) */}
        {toolbar && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line bg-ink-2/50 px-3 py-1.5">
            {toolbar}
          </div>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1">{children}</div>
    </div>
  )
}
