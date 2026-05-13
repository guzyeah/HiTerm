/**
 * 连接列表面板占位组件
 * 后续实现：管理 SSH/Telnet/Serial 等连接会话
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

export const ConnectionsPanel: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <div className={styles.placeholder}>
      <span>{t('activityBar.connectionsPlaceholder')}</span>
    </div>
  )
}