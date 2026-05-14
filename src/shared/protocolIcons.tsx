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
