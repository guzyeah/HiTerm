import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuBar, type MenuItemId } from '@/components/MenuBar/MenuBar'
import { AboutDialog } from '@/components/AboutDialog/AboutDialog'
import { ConnectDialog } from '@/components/ConnectDialog'
import { WorkspacePanel } from '@/components/WorkspacePanel'
import { MainLayout } from '@/components/MainLayout'
import { ActivityBar } from '@/components/ActivityBar'
import './App.css'

function App() {
  const { t } = useTranslation()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)

  const handleMenuItemClick = (itemId: MenuItemId) => {
    if (itemId === 'help.about') {
      setAboutOpen(true)
    } else if (itemId === 'shell.connect') {
      setConnectOpen(true)
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
      <MainLayout
        leftPanel={<ActivityBar />}
        rightPanel={<WorkspacePanel />}
        leftStatusBar={<span>HiTerm</span>}
        rightStatusBar={<span>{t('workspace.statusReady')}</span>}
      />
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}

export default App
