/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DEFAULT_APP_THEME_PREFERENCE,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_LIGATURES,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME_ID,
  type AppThemePreference,
  type ResolvedAppTheme,
  type TerminalPreferences,
} from '@/shared/preferencesTypes'

interface PreferencesContextValue {
  appThemePreference: AppThemePreference
  resolvedAppTheme: ResolvedAppTheme
  terminalPreferences: TerminalPreferences
  setAppThemePreference: (preference: AppThemePreference) => void
  setTerminalFontFamily: (fontFamily: string) => void
  setTerminalFontSize: (fontSize: number) => void
  setTerminalFontLigatures: (enabled: boolean) => void
  setTerminalThemeId: (themeId: string) => void
  setDefaultLocalShellId: (shellId: string | null) => void
}

interface PreferencesProviderProps {
  children: ReactNode
}

const defaultTerminalPreferences: TerminalPreferences = {
  fontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
  fontSize: DEFAULT_TERMINAL_FONT_SIZE,
  fontLigatures: DEFAULT_TERMINAL_FONT_LIGATURES,
  themeId: DEFAULT_TERMINAL_THEME_ID,
  defaultLocalShellId: null,
}

function getSystemTheme(): ResolvedAppTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: PreferencesProviderProps) {
  const [appThemePreference, setAppThemePreferenceState] = useState<AppThemePreference>(DEFAULT_APP_THEME_PREFERENCE)
  const [systemTheme, setSystemTheme] = useState<ResolvedAppTheme>(() => getSystemTheme())
  const [terminalPreferences, setTerminalPreferences] = useState<TerminalPreferences>(defaultTerminalPreferences)

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaQuery) return

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    async function loadPreferences() {
      if (!window.settingsAPI) return

      try {
        const [
          storedAppThemePreference,
          fontFamily,
          fontSize,
          fontLigatures,
          themeId,
          defaultLocalShellId,
        ] = await Promise.all([
          window.settingsAPI.getAppThemePreference(),
          window.settingsAPI.getTerminalFontFamily(),
          window.settingsAPI.getTerminalFontSize(),
          window.settingsAPI.getTerminalFontLigatures(),
          window.settingsAPI.getTerminalThemeId(),
          window.settingsAPI.getDefaultLocalShellId(),
        ])

        setAppThemePreferenceState(storedAppThemePreference)
        setTerminalPreferences({
          fontFamily: fontFamily || DEFAULT_TERMINAL_FONT_FAMILY,
          fontSize: fontSize || DEFAULT_TERMINAL_FONT_SIZE,
          fontLigatures,
          themeId: themeId || DEFAULT_TERMINAL_THEME_ID,
          defaultLocalShellId,
        })
      } catch {
        // 设置加载失败时保留默认值，避免阻塞应用启动。
      }
    }

    void loadPreferences()
  }, [])

  const setAppThemePreference = useCallback((preference: AppThemePreference) => {
    setAppThemePreferenceState(preference)
    void window.settingsAPI?.setAppThemePreference(preference)
  }, [])

  const setTerminalFontFamily = useCallback((fontFamily: string) => {
    const nextFontFamily = fontFamily.trim() || DEFAULT_TERMINAL_FONT_FAMILY
    setTerminalPreferences(previous => ({ ...previous, fontFamily: nextFontFamily }))
    void window.settingsAPI?.setTerminalFontFamily(nextFontFamily)
  }, [])

  const setTerminalFontSize = useCallback((fontSize: number) => {
    const nextFontSize = Math.min(32, Math.max(8, Math.round(fontSize)))
    setTerminalPreferences(previous => ({ ...previous, fontSize: nextFontSize }))
    void window.settingsAPI?.setTerminalFontSize(nextFontSize)
  }, [])

  const setTerminalFontLigatures = useCallback((enabled: boolean) => {
    setTerminalPreferences(previous => ({ ...previous, fontLigatures: enabled }))
    void window.settingsAPI?.setTerminalFontLigatures(enabled)
  }, [])

  const setTerminalThemeId = useCallback((themeId: string) => {
    const nextThemeId = themeId.trim() || DEFAULT_TERMINAL_THEME_ID
    setTerminalPreferences(previous => ({ ...previous, themeId: nextThemeId }))
    void window.settingsAPI?.setTerminalThemeId(nextThemeId)
  }, [])

  const setDefaultLocalShellId = useCallback((shellId: string | null) => {
    setTerminalPreferences(previous => ({ ...previous, defaultLocalShellId: shellId }))
    void window.settingsAPI?.setDefaultLocalShellId(shellId)
  }, [])

  const resolvedAppTheme: ResolvedAppTheme = appThemePreference === 'system' ? systemTheme : appThemePreference

  const value = useMemo<PreferencesContextValue>(() => ({
    appThemePreference,
    resolvedAppTheme,
    terminalPreferences,
    setAppThemePreference,
    setTerminalFontFamily,
    setTerminalFontSize,
    setTerminalFontLigatures,
    setTerminalThemeId,
    setDefaultLocalShellId,
  }), [
    appThemePreference,
    resolvedAppTheme,
    setAppThemePreference,
    setDefaultLocalShellId,
    setTerminalFontFamily,
    setTerminalFontLigatures,
    setTerminalFontSize,
    setTerminalThemeId,
    terminalPreferences,
  ])

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}
