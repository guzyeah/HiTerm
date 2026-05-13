import type { ReactElement } from 'react'
import {
  DesktopRegular,
  GlobeRegular,
  PlugConnectedRegular,
  ProjectionScreenRegular,
  RemoteRegular,
  UsbPlugRegular,
} from '@fluentui/react-icons'
import type { ProtocolType } from './shellTypes'

export const PROTOCOL_ICON_MAP: Record<ProtocolType, ReactElement> = {
  ssh: <GlobeRegular />,
  local: <DesktopRegular />,
  telnet: <PlugConnectedRegular />,
  serial: <UsbPlugRegular />,
  vnc: <ProjectionScreenRegular />,
  rdp: <RemoteRegular />,
}
