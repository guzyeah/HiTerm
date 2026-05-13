/**
 * SSH 连接表单
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Input,
  Label,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { FolderOpenRegular } from '@fluentui/react-icons'
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

interface SSHFormProps {
  data: {
    host: string
    port: number
    username: string
    authType: 'password' | 'privateKey'
    password: string
    privateKeyPath: string
    name: string
    group: string
  }
  onChange: (data: SSHFormProps['data']) => void
  groupList: string[]
}

export function SSHForm({ data, onChange, groupList }: SSHFormProps) {
  const { t } = useTranslation()
  const styles = useStyles()

  const update = useCallback(
    <K extends keyof typeof data>(key: K, value: (typeof data)[K]) => {
      onChange({ ...data, [key]: value })
    },
    [data, onChange],
  )

  const handleBrowseKey = async () => {
    try {
      if (window.dialogAPI) {
        const path = await window.dialogAPI.openFile({
          title: t('connectDialog.selectPrivateKey'),
          filters: [{ name: 'Key Files', extensions: ['key', 'pem', 'ppk'] }],
        })
        if (path) update('privateKeyPath', path)
      }
    } catch {
      // 忽略错误
    }
  }

  return (
    <div className={styles.grid}>
      <Label className={styles.label} required>{t('connectDialog.host')}</Label>
      <Input
        className={styles.field}
        value={data.host}
        onChange={(_, v: any) => update('host', v.value)}
        placeholder={t('connectDialog.hostPlaceholder')}
      />

      <Label className={styles.label} required>{t('connectDialog.port')}</Label>
      <Input
        className={styles.field}
        type="number"
        value={String(data.port)}
        onChange={(_, v: any) => update('port', Number(v.value) || 22)}
        placeholder="22"
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
          appearance={data.authType === 'password' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => update('authType', 'password')}
        >
          {t('connectDialog.password')}
        </Button>
        <Button
          appearance={data.authType === 'privateKey' ? 'primary' : 'secondary'}
          size="small"
          onClick={() => update('authType', 'privateKey')}
        >
          {t('connectDialog.privateKey')}
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

      {data.authType === 'privateKey' && (
        <>
          <Label className={styles.label}>{t('connectDialog.privateKey')}</Label>
          <div className={styles.field} style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
            <Input
              style={{ flex: 1 }}
              value={data.privateKeyPath}
              onChange={(_, v: any) => update('privateKeyPath', v.value)}
              placeholder={t('connectDialog.privateKeyPlaceholder')}
            />
            <Button
              icon={<FolderOpenRegular />}
              size="small"
              onClick={handleBrowseKey}
              aria-label={t('connectDialog.browse')}
            />
          </div>
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
