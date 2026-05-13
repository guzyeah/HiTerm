/**
 * VNC 连接表单
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Input,
  Label,
  makeStyles,
  tokens,
  Combobox,
  Option,
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

interface VNCFormProps {
  data: {
    host: string
    port: number
    password: string
    colorDepth: string
    quality: string
    name: string
    group: string
  }
  onChange: (data: VNCFormProps['data']) => void
  groupList: string[]
}

export function VNCForm({ data, onChange, groupList }: VNCFormProps) {
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
      <Label className={styles.label} required>{t('connectDialog.host')}</Label>
      <Input
        className={styles.field}
        value={data.host}
        onChange={(_, v: any) => update('host', v.value)}
        placeholder={t('connectDialog.hostPlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.port')}</Label>
      <Input
        className={styles.field}
        type="number"
        value={String(data.port)}
        onChange={(_, v: any) => update('port', Number(v.value) || 5900)}
        placeholder="5900"
      />

      <Label className={styles.label}>{t('connectDialog.password')}</Label>
      <Input
        className={styles.field}
        type="password"
        value={data.password}
        onChange={(_, v: any) => update('password', v.value)}
        placeholder={t('connectDialog.passwordPlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.colorDepth')}</Label>
      <Combobox
        className={styles.field}
        value={data.colorDepth}
        onOptionSelect={(_, v) => v.optionValue && update('colorDepth', v.optionValue)}
      >
        <Option text={`8 ${t('connectDialog.bits')}`} value="8">8 {t('connectDialog.bits')}</Option>
        <Option text={`16 ${t('connectDialog.bits')}`} value="16">16 {t('connectDialog.bits')}</Option>
        <Option text={`24 ${t('connectDialog.bits')}`} value="24">24 {t('connectDialog.bits')}</Option>
        <Option text={`32 ${t('connectDialog.bits')}`} value="32">32 {t('connectDialog.bits')}</Option>
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.quality')}</Label>
      <Combobox
        className={styles.field}
        value={data.quality}
        onOptionSelect={(_, v) => v.optionValue && update('quality', v.optionValue)}
      >
        <Option value="low">{t('connectDialog.qualityLow')}</Option>
        <Option value="medium">{t('connectDialog.qualityMedium')}</Option>
        <Option value="high">{t('connectDialog.qualityHigh')}</Option>
        <Option value="auto">{t('connectDialog.qualityAuto')}</Option>
      </Combobox>

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
