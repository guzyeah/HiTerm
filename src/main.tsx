/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import App from './App'
import '@/i18n'
import { LocaleProvider } from '@/contexts/LocaleContext'
import { useLocale } from '@/hooks/useLocale'
import './index.css'

/** 根组件：集成LocaleProvider与FluentProvider */
function Root() {
  const { direction, fontStack } = useLocale()

  // 根据字体栈动态创建Fluent UI主题
  const theme = {
    ...webLightTheme,
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
      <Root />
    </LocaleProvider>
  </React.StrictMode>,
)