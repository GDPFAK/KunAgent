import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from './locales/en/common.json'
import zhCommon from './locales/zh/common.json'
import enSettings from './locales/en/settings.json'
import zhSettings from './locales/zh/settings.json'

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, settings: enSettings },
    zh: { common: zhCommon, settings: zhSettings }
  },
  lng: 'en',
  fallbackLng: 'en',
  // react-i18next expects `escapeValue: false` because React already
  // escapes interpolated values via JSX text rendering. Setting this to
  // `true` would double-escape and produce mojibake like "&amp;quot;".
  interpolation: { escapeValue: false },
  defaultNS: 'common',
  ns: ['common', 'settings'],
  // Disable Suspense so that a missing translation falls through to the
  // `fallbackLng` synchronously rather than suspending the React tree.
  // The previous config did not specify this, leaving it to
  // react-i18next's default of `true` — which means a missing key would
  // throw the surrounding component into a Suspense fallback on first
  // render.
  react: { useSuspense: false },
  // Render the literal key (e.g. "common:settings.title") when missing,
  // rather than `null`. The previous config relied on i18next's default
  // which is `true` (render null) — that produces broken UI silently.
  returnNull: false,
  // Do not call any external translation-management endpoint when a
  // key is missing. The app is shipped with a complete translation
  // set; any missing key is a bug to be fixed, not a runtime fetch.
  saveMissing: false,
  // Surface missing keys in development to catch translation drift
  // early. In production, missing keys fall back to the `fallbackLng`
  // resource and render the key text, which is debuggable without
  // spamming logs.
  missingKeyHandler: (_lngs, _ns, key): void => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] missing translation key: ${String(key)}`)
    }
  }
})

export default i18n
