import { STORE_URL_IOS, STORE_URL_ANDROID } from './constants'

declare const mraid: any
declare const ExitApi: any
declare const FbPlayableAd: any
declare const Luna: any
declare const playableSDK: any

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const storeUrl = () => (isIOS() ? STORE_URL_IOS : STORE_URL_ANDROID)

export async function initMraid(): Promise<void> {
  if (typeof mraid === 'undefined') return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    try {
      if (mraid.getState && mraid.getState() !== 'loading') return done()
      mraid.addEventListener('ready', done)
      setTimeout(done, 2000)
    } catch {
      done()
    }
  })
}

export function bindLifecycle(onPause: () => void, onResume: () => void): void {
  try {
    window.addEventListener('luna:pause', onPause)
    window.addEventListener('luna:resume', onResume)
    window.addEventListener('ad-event-pause', onPause)
    window.addEventListener('ad-event-resume', onResume)
    window.addEventListener('message', (e: MessageEvent) => {
      if (e.data === 'onPause') onPause()
      else if (e.data === 'onResume') onResume()
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onPause()
      else onResume()
    })
  } catch {}
}

export function notifyGameReady(): void { try { (window as any).gameReady?.() } catch {} }
export function notifyGameStart(): void { try { (window as any).gameStart?.() } catch {} }
export function notifyGameEnd():   void { try { (window as any).gameEnd?.()   } catch {} }
export function notifyGameClose(): void { try { (window as any).gameClose?.() } catch {} }

export function triggerCTA(): void {
  notifyGameClose()
  const url = storeUrl()
  try { if (typeof ExitApi !== 'undefined' && ExitApi.exit) return ExitApi.exit() } catch {}
  try { if (typeof FbPlayableAd !== 'undefined' && FbPlayableAd.onCTAClick) return FbPlayableAd.onCTAClick() } catch {}
  try { if (typeof Luna !== 'undefined' && Luna?.Unity?.Playable?.installFullGame) return Luna.Unity.Playable.installFullGame() } catch {}
  try { if (typeof playableSDK !== 'undefined' && typeof playableSDK.openAppStore === 'function') return playableSDK.openAppStore() } catch {}
  try { if (typeof (window as any).install === 'function') return (window as any).install() } catch {}
  try { if (typeof (window as any).openAppStore === 'function') return (window as any).openAppStore() } catch {}
  try { if ((window as any).clickTag) { window.open((window as any).clickTag); return } } catch {}
  try { if ((window as any).__VUNGLE__) { parent.postMessage('download', '*'); return } } catch {}
  try {
    if ((window as any).__TIKTOK__) {
      if (typeof (window as any).openAppStore === 'function') return (window as any).openAppStore()
      window.open(url); return
    }
  } catch {}
  try {
    if (typeof mraid !== 'undefined' && mraid.open && mraid.getState && mraid.getState() !== 'loading') {
      return mraid.open(url)
    }
  } catch {}
  window.open(url)
}
