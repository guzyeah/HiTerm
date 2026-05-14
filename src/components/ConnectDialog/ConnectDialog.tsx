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
 * 连接Shell对话框主组件
 * 包含协议Tab栏和各协议表单
 */

import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogActions,
  DialogTrigger,
  DialogContent,
  Button,
  Tab,
  TabList,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  DismissRegular,
} from '@fluentui/react-icons'
import type { ProtocolType, ProtocolConfig } from './types'
import { SSHForm } from './forms/SSHForm'
import { LocalForm } from './forms/LocalForm'
import { TelnetForm } from './forms/TelnetForm'
import { SerialForm } from './forms/SerialForm'
import { VNCForm } from './forms/VNCForm'
import { RDPForm } from './forms/RDPForm'
import { DEFAULT_SHELL_GROUP_NAME } from '@/shared/shellGroups'
import { PROTOCOL_ICON_MAP } from '@/shared/protocolIcons'
import { emitOpenShellTab } from '@/shared/workspaceEvents'
import type { ShellSummary } from '@/shared/shellTypes'

// ==================== 协议配置 ====================
const PROTOCOLS: ProtocolConfig[] = [
  { id: 'ssh', label: 'SSH', icon: 'ssh', defaultPort: 22 },
  { id: 'local', label: 'Local', icon: 'local' },
  { id: 'telnet', label: 'Telnet', icon: 'telnet', defaultPort: 23 },
  { id: 'serial', label: 'Serial', icon: 'serial' },
  { id: 'vnc', label: 'VNC', icon: 'vnc', defaultPort: 5900 },
  { id: 'rdp', label: 'RDP', icon: 'rdp', defaultPort: 3389 },
]

// ==================== 样式 ====================
const useStyles = makeStyles({
  surface: {
    maxHeight: '85vh',
    minHeight: '600px',
    width: '640px',
    display: 'grid',
  },
  body: {
    minHeight: 0,
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    padding: 0,
  },
  tabList: {
    justifyContent: 'center',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    flexShrink: 0,
  },
  formScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'max-content minmax(0, 1fr)',
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    alignItems: 'center',
  },
  formLabel: {
    justifySelf: 'end',
    textAlign: 'right',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
  },
  formField: {
    justifySelf: 'start',
    width: '100%',
    minWidth: 0,
  },
  divider: {
    gridColumn: '1 / -1',
    margin: `${tokens.spacingVerticalS} 0`,
  },
  actions: {
    gridColumnStart: 1,
    gridColumnEnd: 4,
    justifyContent: 'flex-end',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    gap: tokens.spacingHorizontalS,
    borderTopColor: tokens.colorNeutralStroke2,
    borderTopStyle: 'solid',
    borderTopWidth: tokens.strokeWidthThin,
  },
})

// ==================== 接口 ====================
export interface ConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ==================== 组件 ====================
export function ConnectDialog({ open, onOpenChange }: ConnectDialogProps) {
  const { t } = useTranslation()
  const styles = useStyles()

  // 当前选中的协议
  const [activeProtocol, setActiveProtocol] = useState<ProtocolType>('ssh')

  // 各协议表单数据缓存
  const [sshData, setSshData] = useState<{
    host: string
    port: number
    username: string
    authType: 'password' | 'privateKey'
    password: string
    privateKeyPath: string
    name: string
    group: string
  }>({
    host: '',
    port: 22,
    username: '',
    authType: 'password' as const,
    password: '',
    privateKeyPath: '',
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  const [localData, setLocalData] = useState({
    terminalPath: '',
    workDir: '',
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  const [telnetData, setTelnetData] = useState<{
    host: string
    port: number
    username: string
    authType: 'none' | 'password'
    password: string
    name: string
    group: string
  }>({
    host: '',
    port: 23,
    username: '',
    authType: 'none' as const,
    password: '',
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  const [serialData, setSerialData] = useState<{
    serialPort: string
    baudRate: number
    dataBits: number
    parity: 'none' | 'even' | 'odd'
    stopBits: number
    flowControl: 'none' | 'rtscts' | 'xonxoff'
    name: string
    group: string
  }>({
    serialPort: '',
    baudRate: 9600,
    dataBits: 8,
    parity: 'none' as const,
    stopBits: 1,
    flowControl: 'none' as const,
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  const [vncData, setVncData] = useState({
    host: '',
    port: 5900,
    password: '',
    colorDepth: '24',
    quality: 'high',
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  const [rdpData, setRdpData] = useState({
    host: '',
    port: 3389,
    username: '',
    password: '',
    domain: '',
    resolution: '1920x1080',
    name: '',
    group: DEFAULT_SHELL_GROUP_NAME,
  })

  // 分组列表
  const [groupList, setGroupList] = useState<string[]>([])

  // 串口列表
  const [serialPortList, setSerialPortList] = useState<{ path: string; friendlyName?: string }[]>([])

  // 加载分组列表
  useEffect(() => {
    if (!open) return
    const loadGroups = async () => {
      try {
        if (window.shellAPI) {
          const groups = await window.shellAPI.listGroups()
          setGroupList(groups)
        }
      } catch {
        // 忽略错误
      }
    }
    loadGroups()
  }, [open])

  // 加载串口列表（Serial 协议时）
  useEffect(() => {
    if (activeProtocol !== 'serial' || !open) return
    const loadSerialPorts = async () => {
      try {
        if (window.serialAPI) {
          const ports = await window.serialAPI.listSerialPorts()
          setSerialPortList(ports)
        }
      } catch {
        // 忽略错误
      }
    }
    loadSerialPorts()
  }, [activeProtocol, open])

  // 自动生成 Shell 名称
  const generateName = useCallback((protocol: ProtocolType, data: Record<string, unknown>) => {
    switch (protocol) {
      case 'ssh': {
        const host = data.host as string
        const port = data.port as number
        const username = data.username as string
        if (!host) return ''
        let name = host
        if (port && port !== 22) name += `:${port}`
        if (username) name += ` (${username})`
        return name
      }
      case 'local': {
        const terminalPath = data.terminalPath as string
        return terminalPath || ''
      }
      case 'telnet': {
        const tHost = data.host as string
        const tPort = data.port as number
        const tUser = data.username as string
        if (!tHost) return ''
        let tName = tHost
        if (tPort && tPort !== 23) tName += `:${tPort}`
        if (tUser) tName += ` (${tUser})`
        return tName
      }
      case 'serial': {
        const sp = data.serialPort as string
        return sp || ''
      }
      case 'vnc': {
        const vHost = data.host as string
        const vPort = data.port as number
        if (!vHost) return ''
        let vName = vHost
        if (vPort && vPort !== 5900) vName += `:${vPort}`
        return vName
      }
      case 'rdp': {
        const rHost = data.host as string
        const rPort = data.port as number
        const rUser = data.username as string
        if (!rHost) return ''
        let rName = rHost
        if (rPort && rPort !== 3389) rName += `:${rPort}`
        if (rUser) rName += ` (${rUser})`
        return rName
      }
      default:
        return ''
    }
  }, [])

  // 更新 SSH 名称
  useEffect(() => {
    if (sshData.name) return
    const name = generateName('ssh', sshData)
    if (name) setSshData(prev => ({ ...prev, name }))
  }, [sshData, generateName])

  // 更新 Local 名称
  useEffect(() => {
    if (localData.name) return
    const name = generateName('local', localData)
    if (name) setLocalData(prev => ({ ...prev, name }))
  }, [localData, generateName])

  // 更新 Telnet 名称
  useEffect(() => {
    if (telnetData.name) return
    const name = generateName('telnet', telnetData)
    if (name) setTelnetData(prev => ({ ...prev, name }))
  }, [telnetData, generateName])

  // 更新 Serial 名称
  useEffect(() => {
    if (serialData.name) return
    const name = generateName('serial', serialData)
    if (name) setSerialData(prev => ({ ...prev, name }))
  }, [serialData, generateName])

  // 更新 VNC 名称
  useEffect(() => {
    if (vncData.name) return
    const name = generateName('vnc', vncData)
    if (name) setVncData(prev => ({ ...prev, name }))
  }, [vncData, generateName])

  // 更新 RDP 名称
  useEffect(() => {
    if (rdpData.name) return
    const name = generateName('rdp', rdpData)
    if (name) setRdpData(prev => ({ ...prev, name }))
  }, [rdpData, generateName])

  // 保存处理
  const handleSave = async (connect = false) => {
    let record: Record<string, unknown>

    switch (activeProtocol) {
      case 'ssh': {
        record = {
          protocol: 'ssh',
          name: sshData.name || generateName('ssh', sshData),
          group: sshData.group || null,
          host: sshData.host || null,
          port: sshData.port || null,
          username: sshData.username || null,
          authType: sshData.authType,
          secret: sshData.authType === 'password' ? sshData.password : null,
          privateKeyPath: sshData.authType === 'privateKey' ? sshData.privateKeyPath : null,
        }
        break
      }
      case 'local': {
        record = {
          protocol: 'local',
          name: localData.name || generateName('local', localData),
          group: localData.group || null,
          terminalPath: localData.terminalPath || null,
          workDir: localData.workDir || null,
        }
        break
      }
      case 'telnet': {
        record = {
          protocol: 'telnet',
          name: telnetData.name || generateName('telnet', telnetData),
          group: telnetData.group || null,
          host: telnetData.host || null,
          port: telnetData.port || null,
          username: telnetData.username || null,
          authType: telnetData.authType,
          secret: telnetData.authType === 'password' ? telnetData.password : null,
        }
        break
      }
      case 'serial': {
        record = {
          protocol: 'serial',
          name: serialData.name || generateName('serial', serialData),
          group: serialData.group || null,
          serialPort: serialData.serialPort || null,
          baudRate: serialData.baudRate || null,
          dataBits: serialData.dataBits || null,
          parity: serialData.parity || null,
          stopBits: serialData.stopBits || null,
          flowControl: serialData.flowControl || null,
        }
        break
      }
      case 'vnc': {
        record = {
          protocol: 'vnc',
          name: vncData.name || generateName('vnc', vncData),
          group: vncData.group || null,
          host: vncData.host || null,
          port: vncData.port || null,
          secret: vncData.password || null,
          colorDepth: vncData.colorDepth || null,
          quality: vncData.quality || null,
        }
        break
      }
      case 'rdp': {
        record = {
          protocol: 'rdp',
          name: rdpData.name || generateName('rdp', rdpData),
          group: rdpData.group || null,
          host: rdpData.host || null,
          port: rdpData.port || null,
          username: rdpData.username || null,
          secret: rdpData.password || null,
          domain: rdpData.domain || null,
          resolution: rdpData.resolution || null,
        }
        break
      }
      default:
        return
    }

    try {
      if (window.shellAPI) {
        const savedShell = await window.shellAPI.saveShell(record) as ShellSummary | null
        window.dispatchEvent(new CustomEvent('shells:changed'))
        if (connect && savedShell) {
          emitOpenShellTab(savedShell)
        }
        onOpenChange(false)
      }
    } catch (error) {
      console.error('保存失败:', error)
    }
  }

  // 渲染表单
  const renderForm = () => {
    switch (activeProtocol) {
      case 'ssh':
        return <SSHForm data={sshData} onChange={setSshData} groupList={groupList} />
      case 'local':
        return <LocalForm data={localData} onChange={setLocalData} groupList={groupList} />
      case 'telnet':
        return <TelnetForm data={telnetData} onChange={setTelnetData} groupList={groupList} />
      case 'serial':
        return <SerialForm data={serialData} onChange={setSerialData} groupList={groupList} serialPortList={serialPortList} />
      case 'vnc':
        return <VNCForm data={vncData} onChange={setVncData} groupList={groupList} />
      case 'rdp':
        return <RDPForm data={rdpData} onChange={setRdpData} groupList={groupList} />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody className={styles.body}>
          <DialogTitle
            action={(
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label={t('common.close')} icon={<DismissRegular />} />
              </DialogTrigger>
            )}
          >
            {t('connectDialog.title')}
          </DialogTitle>
          <DialogContent className={styles.content}>
            <TabList
              className={styles.tabList}
              selectedValue={activeProtocol}
              onTabSelect={(_, data) => setActiveProtocol(data.value as ProtocolType)}
            >
              {PROTOCOLS.map(p => (
                <Tab key={p.id} value={p.id} icon={PROTOCOL_ICON_MAP[p.id]}>
                  {p.label}
                </Tab>
              ))}
            </TabList>
            <div className={styles.formScroll}>
              {renderForm()}
            </div>
          </DialogContent>
          <DialogActions className={styles.actions} fluid>
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button appearance="primary" onClick={() => handleSave(false)}>
              {t('connectDialog.save')}
            </Button>
            <Button appearance="primary" onClick={() => handleSave(true)}>
              {t('connectDialog.saveAndConnect')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
