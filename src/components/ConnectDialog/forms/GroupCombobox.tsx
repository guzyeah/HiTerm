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
import { type ChangeEvent, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Combobox, Option } from '@fluentui/react-components'
import { isPresetShellGroupName, SHELL_GROUP_I18N_KEYS } from '@/shared/shellGroups'

interface GroupComboboxProps {
  className?: string
  value: string
  groupList: string[]
  placeholder: string
  onChange: (group: string) => void
}

export function GroupCombobox({
  className,
  value,
  groupList,
  placeholder,
  onChange,
}: GroupComboboxProps) {
  const { t } = useTranslation()

  const getGroupLabel = (group: string) => (
    isPresetShellGroupName(group)
      ? t(SHELL_GROUP_I18N_KEYS[group])
      : group
  )

  const selectedOptions = useMemo(
    () => (groupList.includes(value) ? [value] : []),
    [groupList, value],
  )

  return (
    <Combobox
      className={className}
      freeform
      placeholder={placeholder}
      selectedOptions={selectedOptions}
      value={getGroupLabel(value)}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onOptionSelect={(_, data) => {
        if (data.optionValue) onChange(data.optionValue)
      }}
    >
      {groupList.map(group => {
        const label = getGroupLabel(group)
        return (
          <Option key={group} text={label} value={group}>
            {label}
          </Option>
        )
      })}
    </Combobox>
  )
}
