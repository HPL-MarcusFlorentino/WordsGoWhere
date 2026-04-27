declare const ALPlayableAnalytics: any
declare const playableSDK: any

export type AnalyticsEvent =
  | 'DISPLAYED'
  | 'CTA_CLICKED'
  | 'ENDCARD_SHOWN'
  | 'CHALLENGE_STARTED'
  | 'CHALLENGE_SOLVED'
  | 'CHALLENGE_FAILED'

export function trackEvent(event: AnalyticsEvent): void {
  try {
    if (typeof ALPlayableAnalytics !== 'undefined' && typeof ALPlayableAnalytics.trackEvent === 'function') {
      return ALPlayableAnalytics.trackEvent(event)
    }
  } catch {}
  try {
    if (typeof playableSDK !== 'undefined' && typeof playableSDK.reportEvent === 'function') {
      return playableSDK.reportEvent(event)
    }
  } catch {}
  console.log('[Analytics]', event)
}
