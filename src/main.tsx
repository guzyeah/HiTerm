/*
 * HiTerm - A beautiful and easy-to-use integrated remote connection tool
 * Copyright (c) 2026 Guzyeah Software
 *
 * This software is released under a dual licensing model:
 * 1. AGPL-3.0-only (see LICENSE.AGPL for details)
 * 2. Commercial Proprietary License (please contact to guzyeah@foxmail.com)
 *
 * You may choose the license that best suits your needs.
 */
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

  React.useEffect(() => {
    document.documentElement.dataset.appTheme = resolvedAppTheme
    document.documentElement.style.colorScheme = resolvedAppTheme
  }, [resolvedAppTheme])

  // 根据字体栈动态创建Fluent UI主题
  const theme = {
    ...fluentTheme,
    fontFamilyDefault: fontStack,
    fontFamilyMonospace: '"Cascadia Code", "Fira Code", "Consolas", monospace',
  }

  return (
    <FluentProvider theme={theme} dir={direction} data-app-theme={resolvedAppTheme}>
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
