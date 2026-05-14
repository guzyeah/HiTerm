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
import type { ShellSummary } from './shellTypes'

const OPEN_SHELL_TAB_EVENT = 'workspace:openShellTab'

type OpenShellTabHandler = (shell: ShellSummary) => void

export function emitOpenShellTab(shell: ShellSummary): void {
  window.dispatchEvent(new CustomEvent<ShellSummary>(OPEN_SHELL_TAB_EVENT, { detail: shell }))
}

export function subscribeOpenShellTab(handler: OpenShellTabHandler): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<ShellSummary>).detail)
  }

  window.addEventListener(OPEN_SHELL_TAB_EVENT, listener)
  return () => window.removeEventListener(OPEN_SHELL_TAB_EVENT, listener)
}
