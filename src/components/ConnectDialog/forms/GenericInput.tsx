/**
 * 通用输入组件封装
 * 解决 Fluent UI Input 组件在 TypeScript 5.x 中的类型兼容性问题
 */

import { Input as FluentInput } from '@fluentui/react-components'
import type { InputProps } from '@fluentui/react-components'
import type { ChangeEvent } from 'react'

interface GenericInputProps extends Omit<InputProps, 'onChange'> {
  onChange?: (value: string) => void
}

export function Input({ onChange, ...props }: GenericInputProps) {
  const handleChange = (ev: ChangeEvent<HTMLInputElement>) => {
    onChange?.(ev.target.value)
  }

  return <FluentInput {...props} onChange={handleChange as any} />
}
