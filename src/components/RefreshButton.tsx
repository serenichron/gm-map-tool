import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Updates the app live without a relaunch. The service worker auto-updates on
 * launch, but an installed app left open won't notice — this button checks for a
 * new version periodically and applies it on demand. When one is waiting it gets
 * a gold dot; clicking applies + reloads (or just reloads if nothing's pending).
 */
export function RefreshButton() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (r) setInterval(() => void r.update(), 60_000)
    },
  })

  const refresh = () => {
    if (needRefresh) void updateServiceWorker(true)
    else location.reload()
  }

  return (
    <button
      onClick={refresh}
      title={needRefresh ? 'Update available — tap to refresh' : 'Refresh'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-line bg-panel-2 text-bone transition hover:border-[#6a5232] hover:bg-[#352818]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[16px] w-[16px]">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      {needRefresh && (
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-panel bg-gold" />
      )}
    </button>
  )
}
