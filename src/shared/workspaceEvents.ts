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
