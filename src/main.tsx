/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components'
import App from './App'
import '@/i18n'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { useLocale } from '@/hooks/useLocale'
import { usePreferences } from '@/hooks/usePreferences'
import './index.css'

/** 根组件：集成LocaleProvider与FluentProvider */
function Root() {
  const { direction, fontStack } = useLocale()
  const { resolvedAppTheme } = usePreferences()
  const fluentTheme = resolvedAppTheme === 'dark' ? webDarkTheme : webLightTheme

  // 根据字体栈动态创建Fluent UI主题
  const theme = {
    ...fluentTheme,
    fontFamilyDefault: fontStack,
    fontFamilyMonospace: '"Cascadia Code", "Fira Code", "Consolas", monospace',
  }

  return (
    <FluentProvider theme={theme} dir={direction}>
      <App />
    </FluentProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <PreferencesProvider>
        <Root />
      </PreferencesProvider>
    </LocaleProvider>
  </React.StrictMode>,
)
