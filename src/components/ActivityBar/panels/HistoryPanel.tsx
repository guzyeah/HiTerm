/**
 * 历史命令面板占位组件
 * 后续实现：命令历史搜索与复用
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

export const HistoryPanel: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <div className={styles.placeholder}>
      <span>{t('activityBar.historyPlaceholder')}</span>
    </div>
  )
}