/**
 * Telnet 连接表单
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Input,
  Label,
  Button,
  makeStyles,
  tokens,
  Combobox,
  Option,
} from '@fluentui/react-components'

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
  authButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  divider: {
    gridColumn: '1 / -1',
    margin: `${tokens.spacingVerticalS} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    height: '1px',
  },
})

interface TelnetFormProps {
  data: {
    host: string
    port: number
    username: string
    authType: 'none' | 'password'
    password: string
    name: string
    group: string
  }
  onChange: (data: TelnetFormProps['data']) => void
  groupList: string[]
}

export function TelnetForm({ data, onChange, groupList }: TelnetFormProps) {
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
        onChange={(_, v: any) => update('port', Number(v.value) || 23)}
        placeholder="23"
      />

      <Label className={styles.label}>{t('connectDialog.username')}</Label>
      <Input
        className={styles.field}
        value={data.username}
        onChange={(_, v: any) => update('username', v.value)}
        placeholder={t('connectDialog.usernamePlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.authType')}</Label>
      <div className={styles.authButtons}>
        <Button
          appearance={data.authType === 'none' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => update('authType', 'none')}
        >
          {t('connectDialog.noAuth')}
        </Button>
        <Button
          appearance={data.authType === 'password' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => update('authType', 'password')}
        >
          {t('connectDialog.password')}
        </Button>
      </div>

      {data.authType === 'password' && (
        <>
          <Label className={styles.label}>{t('connectDialog.password')}</Label>
          <Input
            className={styles.field}
            type="password"
            value={data.password}
            onChange={(_, v: any) => update('password', v.value)}
            placeholder={t('connectDialog.passwordPlaceholder')}
          />
        </>
      )}

      <div className={styles.divider} />

      <Label className={styles.label}>{t('connectDialog.name')}</Label>
      <Input
        className={styles.field}
        value={data.name}
        onChange={(_, v: any) => update('name', v.value)}
        placeholder={t('connectDialog.namePlaceholder')}
      />

      <Label className={styles.label}>{t('connectDialog.group')}</Label>
      <Combobox
        className={styles.field}
        value={data.group}
        onOptionSelect={(_, v) => v.optionValue && update('group', v.optionValue)}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('group', e.target.value)}
        freeform
        placeholder={t('connectDialog.groupPlaceholder')}
      >
        {groupList.map(g => (
          <Option key={g} value={g}>{g}</Option>
        ))}
      </Combobox>
    </div>
  )
}
