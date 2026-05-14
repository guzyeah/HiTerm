import { useState, useEffect } from 'react'
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

  const handleMenuItemClick = (itemId: MenuItemId) => {
    if (itemId === 'help.about') {
      setAboutOpen(true)
    } else if (itemId === 'shell.connect') {
      setConnectOpen(true)
    } else if (itemId === 'settings.preferences') {
      setPreferencesOpen(true)
    }
  }

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

  return (
    <div className="app-shell">
      <MenuBar onMenuItemClick={handleMenuItemClick} />
      <WorkspaceRuntimeProvider>
        <MainLayout
          leftPanel={<ActivityBar />}
          rightPanel={<WorkspacePanel />}
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
          rightStatusBar={<TerminalStatusBar />}
        />
      </WorkspaceRuntimeProvider>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <PreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </div>
  )
}

export default App
