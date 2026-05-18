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
import { useCallback, useState, useEffect } from 'react'
import { Link, makeStyles, tokens } from '@fluentui/react-components'
import { useTranslation } from 'react-i18next'
import { MenuBar, type MenuItemId } from '@/components/MenuBar/MenuBar'
import { AboutDialog } from '@/components/AboutDialog/AboutDialog'
import { ConnectDialog } from '@/components/ConnectDialog'
import { PreferencesDialog } from '@/components/PreferencesDialog'
import { WorkspacePanel, WorkspaceRuntimeProvider } from '@/components/WorkspacePanel'
import { MainLayout } from '@/components/MainLayout'
import { ActivityBar } from '@/components/ActivityBar'
import { TerminalStatusBar } from '@/components/StatusBar'
import type { TerminalViewMode } from '@/shared/terminalViewTypes'
import './App.css'

const DONATE_URL = 'https://www.guzyeah.cn/donate'

const useStyles = makeStyles({
  leftStatusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalS,
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
  },
  leftStatusText: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: tokens.fontSizeBase100,
  },
  donateLink: {
    flexShrink: 0,
    fontSize: tokens.fontSizeBase200,
  },
})

function App() {
  const styles = useStyles()
  const { t } = useTranslation()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [terminalViewMode, setTerminalViewMode] = useState<TerminalViewMode>('normal')

  const handleMenuItemClick = (itemId: MenuItemId) => {
    if (itemId === 'help.about') {
      setAboutOpen(true)
    } else if (itemId === 'shell.connect') {
      setConnectOpen(true)
    } else if (itemId === 'settings.preferences') {
      setPreferencesOpen(true)
    }
  }

  const handleTerminalViewModeChange = useCallback((mode: TerminalViewMode) => {
    setTerminalViewMode(mode)
    void window.windowAPI?.setFullscreen(mode === 'fullscreen')
  }, [])

  // 监听macOS原生菜单的IPC点击事件
  useEffect(() => {
    if (!window.ipcRenderer) return
    const handler = (_event: Electron.IpcRendererEvent, itemId: string) => {
      if (itemId === 'help.about') {
        setAboutOpen(true)
      } else if (itemId === 'shell.connect') {
        setConnectOpen(true)
      } else if (itemId === 'settings.preferences') {
        setPreferencesOpen(true)
      }
    }
    window.ipcRenderer.on('menu:click', handler)
    return () => {
      window.ipcRenderer.off('menu:click', handler)
    }
  }, [])

  useEffect(() => {
    if (!window.windowAPI) return

    let isMounted = true
    void window.windowAPI.isFullscreen().then(isFullscreen => {
      if (isMounted && isFullscreen) {
        setTerminalViewMode('fullscreen')
      }
    })

    const unsubscribe = window.windowAPI.onFullscreenChange(isFullscreen => {
      setTerminalViewMode(previous => {
        if (isFullscreen) {
          return 'fullscreen'
        }

        return previous === 'fullscreen' ? 'normal' : previous
      })
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="app-shell">
      {terminalViewMode === 'normal' && <MenuBar onMenuItemClick={handleMenuItemClick} />}
      <WorkspaceRuntimeProvider>
        <MainLayout
          leftPanel={<ActivityBar />}
          rightPanel={<WorkspacePanel focusMode={terminalViewMode !== 'normal'} />}
          leftStatusBar={(
            <span className={styles.leftStatusBar} dir="ltr">
              <span className={styles.leftStatusText}>{`${t('app.name')} by Guzyeah, Free for Everyone`}</span>
              <Link
                className={styles.donateLink}
                href={DONATE_URL}
                rel="noreferrer"
                target="_blank"
              >
                {t('status.donate')}
              </Link>
            </span>
          )}
          rightStatusBar={(
            <TerminalStatusBar
              terminalViewMode={terminalViewMode}
              onTerminalViewModeChange={handleTerminalViewModeChange}
            />
          )}
          terminalViewMode={terminalViewMode}
        />
      </WorkspaceRuntimeProvider>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </div>
  )
}

export default App
