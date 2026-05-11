/**
 * 自绘菜单栏组件
 * 仅在Win/Linux平台渲染，macOS使用原生菜单栏不渲染此组件
 * 使用Fluent UI Toolbar + Menu组合实现水平菜单栏
 */

import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Toolbar,
  ToolbarButton,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
} from '@fluentui/react-components'
import { useLocale } from '@/hooks/useLocale'

/** 菜单项ID，与macOS原生菜单的IPC标识保持一致 */
export type MenuItemId = 'shell.connect' | 'shell.management' | 'settings.preferences' | 'help.about'

interface MenuBarProps {
  onMenuItemClick?: (itemId: MenuItemId) => void
}

/** Shell菜单（一级菜单 + 子菜单项） */
function ShellMenu({ onMenuItemClick }: MenuBarProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger>
        <ToolbarButton>{t('menu.shell')}</ToolbarButton>
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
function SettingsMenu({ onMenuItemClick }: MenuBarProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger>
        <ToolbarButton>{t('menu.settings')}</ToolbarButton>
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
function HelpMenu({ onMenuItemClick }: MenuBarProps) {
  const { t } = useTranslation()

  return (
    <Menu>
      <MenuTrigger>
        <ToolbarButton>{t('menu.help')}</ToolbarButton>
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

/** 自绘菜单栏：仅在Win/Linux渲染 */
export const MenuBar: FC<MenuBarProps> = ({ onMenuItemClick }) => {
  const { platform } = useLocale()

  // macOS使用原生菜单栏，不渲染自绘菜单
  if (platform === 'darwin') return null

  return (
    <Toolbar size="small" role="menubar" aria-label="Application menu bar">
      <ShellMenu onMenuItemClick={onMenuItemClick} />
      <SettingsMenu onMenuItemClick={onMenuItemClick} />
      <HelpMenu onMenuItemClick={onMenuItemClick} />
    </Toolbar>
  )
}