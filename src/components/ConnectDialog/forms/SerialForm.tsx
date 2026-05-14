/*
 * HiTerm - A beautiful and easy-to-use integrated remote connection tool
 * Copyright (c) 2026 Guzyeah Software
 *
 * This software is released under a dual licensing model:
 * 1. AGPL-3.0-only (see LICENSE.AGPL for details)
 * 2. Commercial Proprietary License (please contact to guzyeah@foxmail.com)
 *
 * You may choose the license that best suits your needs.
 */
/**
 * Serial 连接表单
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

interface SerialFormProps {
  data: {
    serialPort: string
    baudRate: number
    dataBits: number
    parity: 'none' | 'even' | 'odd'
    stopBits: number
    flowControl: 'none' | 'rtscts' | 'xonxoff'
    name: string
    group: string
  }
  onChange: (data: SerialFormProps['data']) => void
  groupList: string[]
  serialPortList: { path: string; friendlyName?: string }[]
}

export function SerialForm({ data, onChange, groupList, serialPortList }: SerialFormProps) {
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
      <Label className={styles.label} required>{t('connectDialog.serialPort')}</Label>
      <Combobox
        className={styles.field}
        value={data.serialPort}
        onOptionSelect={(_, v) => v.optionValue && update('serialPort', v.optionValue)}
        // @ts-ignore
        onChange={(_, v: any) => update('serialPort', v.value as string)}
        freeform
        placeholder={t('connectDialog.serialPortPlaceholder')}
      >
        {serialPortList.map(sp => (
          <Option key={sp.path} value={sp.path}>{sp.friendlyName || sp.path}</Option>
        ))}
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.baudRate')}</Label>
      <Combobox
        className={styles.field}
        value={String(data.baudRate)}
        onOptionSelect={(_, v) => v.optionValue && update('baudRate', Number(v.optionValue))}
        // @ts-ignore
        onChange={(_, v: any) => update('baudRate', Number(v.value) || 9600)}
        freeform
      >
        {[9600, 19200, 38400, 57600, 115200].map(rate => (
          <Option key={rate} text={String(rate)} value={String(rate)}>{rate}</Option>
        ))}
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.dataBits')}</Label>
      <Combobox
        className={styles.field}
        value={String(data.dataBits)}
        onOptionSelect={(_, v) => v.optionValue && update('dataBits', Number(v.optionValue))}
        // @ts-ignore
        onChange={(_, v: any) => update('dataBits', Number(v.value) || 8)}
      >
        {[5, 6, 7, 8].map(bits => (
          <Option key={bits} text={String(bits)} value={String(bits)}>{bits}</Option>
        ))}
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.parity')}</Label>
      <Combobox
        className={styles.field}
        value={data.parity}
        onOptionSelect={(_, v) => v.optionValue && update('parity', v.optionValue as 'none' | 'even' | 'odd')}
      >
        <Option value="none">{t('connectDialog.parityNone')}</Option>
        <Option value="even">{t('connectDialog.parityEven')}</Option>
        <Option value="odd">{t('connectDialog.parityOdd')}</Option>
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.stopBits')}</Label>
      <Combobox
        className={styles.field}
        value={String(data.stopBits)}
        onOptionSelect={(_, v) => v.optionValue && update('stopBits', Number(v.optionValue))}
        // @ts-ignore
        onChange={(_, v: any) => update('stopBits', Number(v.value) || 1)}
      >
        {[1, 1.5, 2].map(bits => (
          <Option key={bits} text={String(bits)} value={String(bits)}>{bits}</Option>
        ))}
      </Combobox>

      <Label className={styles.label}>{t('connectDialog.flowControl')}</Label>
      <Combobox
        className={styles.field}
        value={data.flowControl}
        onOptionSelect={(_, v) => v.optionValue && update('flowControl', v.optionValue as 'none' | 'rtscts' | 'xonxoff')}
      >
        <Option value="none">{t('connectDialog.flowControlNone')}</Option>
        <Option value="rtscts">{t('connectDialog.flowControlRtscts')}</Option>
        <Option value="xonxoff">{t('connectDialog.flowControlXonxoff')}</Option>
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
