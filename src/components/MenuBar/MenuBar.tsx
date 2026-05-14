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
 * 自绘菜单栏组件
 * 仅在 Win/Linux 平台渲染，macOS 使用原生菜单栏。
 * 使用 Fluent UI Button + Menu 组合实现轻量桌面应用菜单栏。
 */

import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { useLocale } from '@/hooks/useLocale'

/** 菜单项 ID，与 macOS 原生菜单的 IPC 标识保持一致 */
export type MenuItemId = 'shell.connect' | 'shell.management' | 'settings.preferences' | 'help.about'

interface MenuBarProps {
  onMenuItemClick?: (itemId: MenuItemId) => void
}

interface MenuBarItemProps extends MenuBarProps {
  triggerClassName: string
}

const useStyles = makeStyles({
  root: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    minHeight: '32px',
    boxSizing: 'border-box',
    gap: tokens.spacingHorizontalXXS,
    paddingInlineStart: tokens.spacingHorizontalS,
    paddingInlineEnd: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderBottomStyle: 'solid',
    borderBottomWidth: tokens.strokeWidthThin,
  },
  trigger: {
    minWidth: 'unset',
    height: '26px',
    paddingInlineStart: tokens.spacingHorizontalS,
    paddingInlineEnd: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    fontWeight: tokens.fontWeightRegular,
  },
})

/** Shell 菜单（一级菜单 + 子菜单项） */
function ShellMenu({ onMenuItemClick, triggerClassName }: MenuBarItemProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={triggerClassName} role="menuitem" size="small">
          {t('menu.shell')}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => onMenuItemClick?.('shell.connect')}>
            {t('menu.shell.connect')}
          </MenuItem>
          <MenuItem onClick={() => onMenuItemClick?.('shell.management')}>
            {t('menu.shell.management')}
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

/** 设置菜单 */
function SettingsMenu({ onMenuItemClick, triggerClassName }: MenuBarItemProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={triggerClassName} role="menuitem" size="small">
          {t('menu.settings')}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => onMenuItemClick?.('settings.preferences')}>
            {t('menu.settings.preferences')}
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

/** 帮助菜单 */
function HelpMenu({ onMenuItemClick, triggerClassName }: MenuBarItemProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={triggerClassName} role="menuitem" size="small">
          {t('menu.help')}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItem onClick={() => onMenuItemClick?.('help.about')}>
            {t('menu.help.about')}
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

/** 自绘菜单栏：仅在 Win/Linux 渲染 */
export const MenuBar: FC<MenuBarProps> = ({ onMenuItemClick }) => {
  const { platform } = useLocale()
  const { t } = useTranslation()
  const styles = useStyles()

  if (platform === 'darwin') return null

  return (
    <nav className={styles.root} role="menubar" aria-label={t('menu.applicationMenuBar')}>
      <ShellMenu onMenuItemClick={onMenuItemClick} triggerClassName={styles.trigger} />
      <SettingsMenu onMenuItemClick={onMenuItemClick} triggerClassName={styles.trigger} />
      <HelpMenu onMenuItemClick={onMenuItemClick} triggerClassName={styles.trigger} />
    </nav>
  )
}
