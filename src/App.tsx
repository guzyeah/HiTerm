import { useTranslation } from 'react-i18next'
import './App.css'

function App() {
  const { t } = useTranslation()

  return (
    <>
      <h1>{t('app.name')}</h1>
      <p>{t('app.description')}</p>
    </>
  )
}

export default App