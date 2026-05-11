/**
 * i18next 初始化配置
 * 全量打包所有11种语言资源，同步初始化
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import it from './locales/it.json'
import es from './locales/es.json'
import ar from './locales/ar.json'
import vi from './locales/vi.json'

import { detectSystemLocale } from './localeDetector'

/** 全量打包的语言资源 */
const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  ja: { translation: ja },
  ko: { translation: ko },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  es: { translation: es },
  ar: { translation: ar },
  vi: { translation: vi },
}

/** 检测初始语言：优先从electron-store读取，否则从OS检测 */
function getInitialLocale(): string {
  // electron-store偏好将在LocaleContext中异步加载后应用
  // 同步初始化时使用OS检测
  return detectSystemLocale()
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  keySeparator: '.',
  nsSeparator: ':',
})

export default i18n