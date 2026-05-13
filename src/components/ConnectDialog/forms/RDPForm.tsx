/**
 * RDP 连接表单
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

interface RDPFormProps {
  data: {
    host: string
    port: number
    username: string
    password: string
    domain: string
    resolution: string
    name: string
    group: string
  }
  onChange: (data: RDPFormProps['data']) => void
  groupList: string[]
}

export function RDPForm({ data, onChange, groupList }: RDPFormProps) {
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
        onChange={(_, v: any) => update('port', Number(v.value) || 3389)}
        placeholder="3389"
      />

      <Label className={styles.label}>{t('connectDialog.username')}</Label>
      <Input
        className={styles.field}
        value={data.username}
        onChange={(_, v: any) => update('username', v.value)}
        placeholder={t('connectDialog.usernamePlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.password')}</Label>
      <Input
        className={styles.field}
        type="password"
        value={data.password}
        onChange={(_, v: any) => update('password', v.value)}
        placeholder={t('connectDialog.passwordPlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.domain')}</Label>
      <Input
        className={styles.field}
        value={data.domain}
        onChange={(_, v: any) => update('domain', v.value)}
        placeholder={t('connectDialog.domainPlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.resolution')}</Label>
      <Combobox
        className={styles.field}
        value={data.resolution}
        onOptionSelect={(_, v) => v.optionValue && update('resolution', v.optionValue)}
        freeform
      >
        <Option value="640x480">640x480</Option>
        <Option value="800x600">800x600</Option>
        <Option value="1024x768">1024x768</Option>
        <Option value="1280x720">1280x720</Option>
        <Option value="1366x768">1366x768</Option>
        <Option value="1440x900">1440x900</Option>
        <Option value="1600x900">1600x900</Option>
        <Option value="1680x1050">1680x1050</Option>
        <Option value="1920x1080">1920x1080</Option>
        <Option value="2560x1440">2560x1440</Option>
        <Option value="3840x2160">3840x2160</Option>
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
