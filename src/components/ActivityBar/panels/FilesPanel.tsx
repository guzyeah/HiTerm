/**
 * 文件管理面板占位组件
 * 后续实现：远程/本地文件浏览与管理
 */

import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
  },
})

export const FilesPanel: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <div className={styles.placeholder}>
      <span>{t('activityBar.filesPlaceholder')}</span>
    </div>
  )
}