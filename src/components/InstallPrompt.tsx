import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'stranded-install-dismissed'

/**
 * Invites visitors to install the app to their home screen.
 * - Android / desktop Chrome-family: uses the native beforeinstallprompt.
 * - iOS Safari: no prompt API, so we show the Share → Add to Home Screen hint.
 * Hidden once installed (running standalone) or dismissed.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone || localStorage.getItem(DISMISS_KEY) === '1') return

    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIsIOS(true)
      setShow(true)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    const onInstalled = () => {
      setShow(false)
      localStorage.setItem(DISMISS_KEY, '1')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      /* ignore */
    }
    setShow(false)
    setDeferred(null)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl border border-line bg-gradient-to-b from-panel-2 to-panel p-3 shadow-2xl">
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt=""
          className="h-11 w-11 flex-none rounded-[10px]"
        />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-semibold text-bone">Install the field map</div>
          {isIOS ? (
            <div className="font-ui text-[12px] leading-snug text-bone-dim">
              Tap <span className="text-gold">Share</span>, then{' '}
              <span className="text-gold">Add to Home Screen</span>.
            </div>
          ) : (
            <div className="font-ui text-[12px] text-bone-dim">Keep it on your device, open it like an app.</div>
          )}
        </div>
        {!isIOS && (
          <button
            onClick={install}
            className="flex-none rounded-[9px] border border-ochre bg-gradient-to-b from-[#3a2a18] to-[#2a1f13] px-4 py-2 font-ui text-[13px] font-semibold text-gold"
          >
            Install
          </button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-none rounded-[8px] px-2 py-1 font-ui text-[18px] text-bone-dim hover:bg-[#2a2015] hover:text-bone"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
