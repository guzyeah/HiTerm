/**
 * Local 终端表单
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Input,
  Label,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { GroupCombobox } from './GroupCombobox'

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: '120px minmax(0, 1fr)',
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    alignItems: 'center',
  },
  label: {
    justifySelf: 'end',
    textAlign: 'right',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
  },
  field: {
    justifySelf: 'start',
    width: '100%',
    minWidth: 0,
  },
  divider: {
    gridColumn: '1 / -1',
    margin: `${tokens.spacingVerticalS} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    height: '1px',
  },
})

interface LocalFormProps {
  data: {
    terminalPath: string
    workDir: string
    name: string
    group: string
  }
  onChange: (data: LocalFormProps['data']) => void
  groupList: string[]
}

export function LocalForm({ data, onChange, groupList }: LocalFormProps) {
  const { t } = useTranslation()
  const styles = useStyles()

  const update = useCallback(
    <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
      onChange({ ...data, [key]: value })
    },
    [data, onChange],
  )

  return (
    <div className={styles.grid}>
      <Label className={styles.label}>{t('connectDialog.terminalPath')}</Label>
      <Input
        className={styles.field}
        value={data.terminalPath}
        onChange={(_, v: any) => update('terminalPath', v.value)}
        placeholder={t('connectDialog.terminalPathPlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.workDir')}</Label>
      <Input
        className={styles.field}
        value={data.workDir}
        onChange={(_, v: any) => update('workDir', v.value)}
        placeholder={t('connectDialog.workDirPlaceholder')}
      />

      <div className={styles.divider} />

      <Label className={styles.label}>{t('connectDialog.name')}</Label>
      <Input
        className={styles.field}
        value={data.name}
        onChange={(_, v: any) => update('name', v.value)}
        placeholder={t('connectDialog.namePlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.group')}</Label>
      <GroupCombobox
        className={styles.field}
        value={data.group}
        groupList={groupList}
        placeholder={t('connectDialog.groupPlaceholder')}
        onChange={group => update('group', group)}
      />
    </div>
  )
}
