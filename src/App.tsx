import { useTranslation } from 'react-i18next'
import { MenuBar, type MenuItemId } from '@/components/MenuBar/MenuBar'
import './App.css'

function App() {
  const { t } = useTranslation()

  const handleMenuItemClick = (itemId: MenuItemId) => {
    // 菜单功能暂不实现，预留handler接口
    console.log('Menu item clicked:', itemId)
  }

  return (
    <>
      <MenuBar onMenuItemClick={handleMenuItemClick} />
      <main className="app-content">
        <h1>{t('app.name')}</h1>
        <p>{t('app.description')}</p>
      </main>
    </>
  )
}

export default App