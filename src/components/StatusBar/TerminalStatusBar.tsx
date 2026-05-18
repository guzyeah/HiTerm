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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowExportRegular,
  ArrowImportRegular,
  ArrowMaximizeRegular,
  ArrowMinimizeRegular,
  ArrowUploadRegular,
  FullScreenMaximizeRegular,
  FullScreenMinimizeRegular,
  HardDriveRegular,
  MicOffRegular,
  MicRegular,
} from '@fluentui/react-icons'
import { useTerminalStatus } from '@/hooks/useTerminalStatus'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { MiniTrendChart } from './MiniTrendChart'
import type { TerminalStatusDisk } from '@/shared/terminalStatusTypes'
import type { TerminalViewMode } from '@/shared/terminalViewTypes'

interface TerminalStatusBarProps {
  terminalViewMode: TerminalViewMode
  onTerminalViewModeChange: (mode: TerminalViewMode) => void
}

interface TrendMetricProps {
  history: Array<number | null>
  label: string
  value: number | null | undefined
  withDivider?: boolean
}

interface SpeedMetricProps {
  icon: ReactNode
  label: string
  value: number | null | undefined
  withDivider?: boolean
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly [index: number]: {
    readonly transcript: string
  }
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: {
    readonly length: number
    readonly [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start: () => void
  stop: () => void
}

const STATUS_ITEM_GAP = '0'
const TREND_METRIC_WIDTH = '96px'
const SPEED_METRIC_WIDTH = '76px'
const DISK_METRIC_WIDTH = '92px'
const SPEED_VALUE_WIDTH = '54px'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: STATUS_ITEM_GAP,
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  metricsGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: STATUS_ITEM_GAP,
    minWidth: 0,
    overflow: 'hidden',
  },
  actionsGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
    marginInlineStart: tokens.spacingHorizontalM,
  },
  metric: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    minWidth: 0,
    flexShrink: 0,
    height: '24px',
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  itemDivider: {
    position: 'relative',
    marginInlineStart: tokens.spacingHorizontalXS,
    paddingInlineStart: tokens.spacingHorizontalXS,
    '::before': {
      position: 'absolute',
      insetInlineStart: 0,
      top: '4px',
      bottom: '4px',
      width: tokens.strokeWidthThin,
      content: '""',
      backgroundColor: tokens.colorNeutralStrokeAccessible,
      opacity: 0.72,
    },
  },
  trendMetric: {
    width: TREND_METRIC_WIDTH,
    flexBasis: TREND_METRIC_WIDTH,
  },
  speedMetric: {
    width: SPEED_METRIC_WIDTH,
    flexBasis: SPEED_METRIC_WIDTH,
  },
  metricLabel: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground3,
  },
  metricValue: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground2,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  speedValue: {
    width: SPEED_VALUE_WIDTH,
    overflow: 'hidden',
    textAlign: 'end',
    textOverflow: 'ellipsis',
  },
  icon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 16px',
    color: tokens.colorNeutralForeground3,
    fontSize: '14px',
  },
  diskButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    flex: `0 0 ${DISK_METRIC_WIDTH}`,
    width: DISK_METRIC_WIDTH,
    minWidth: DISK_METRIC_WIDTH,
    height: '24px',
    padding: 0,
    border: 0,
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    cursor: 'default',
    font: 'inherit',
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  diskValue: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textAlign: 'end',
    textOverflow: 'ellipsis',
  },
  popoverSurface: {
    minWidth: '360px',
    maxWidth: '520px',
    padding: tokens.spacingHorizontalM,
  },
  diskTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
  },
  diskHeader: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: 'left',
    paddingBottom: tokens.spacingVerticalXS,
    whiteSpace: 'nowrap',
  },
  diskCell: {
    paddingBlock: tokens.spacingVerticalXXS,
    paddingInlineEnd: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  actionButton: {
    width: '28px',
    minWidth: '28px',
    height: '24px',
    padding: 0,
    borderRadius: tokens.borderRadiusMedium,
  },
  actionButtonActive: {
    color: tokens.colorBrandForeground1,
    backgroundColor: tokens.colorBrandBackground2,
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
})

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'
  return `${Math.round(value)}%`
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let nextValue = Math.max(0, value)
  let unitIndex = 0
  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024
    unitIndex += 1
  }

  const precision = nextValue >= 10 || unitIndex === 0 ? 0 : 1
  return `${nextValue.toFixed(precision)} ${units[unitIndex]}`
}

function formatBytesPerSecond(value: number | null | undefined): string {
  const formatted = formatBytes(value)
  return formatted === '--' ? formatted : `${formatted}/s`
}

function TrendMetric({ history, label, value, withDivider = false }: TrendMetricProps) {
  const styles = useStyles()

  return (
    <span
      className={mergeClasses(
        styles.metric,
        styles.trendMetric,
        withDivider ? styles.itemDivider : undefined,
      )}
      title={`${label} ${formatPercent(value)}`}
    >
      <MiniTrendChart values={history} />
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{formatPercent(value)}</span>
    </span>
  )
}

function SpeedMetric({ icon, label, value, withDivider = false }: SpeedMetricProps) {
  const styles = useStyles()

  return (
    <span
      className={mergeClasses(
        styles.metric,
        styles.speedMetric,
        withDivider ? styles.itemDivider : undefined,
      )}
      title={`${label} ${formatBytesPerSecond(value)}`}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={mergeClasses(styles.metricValue, styles.speedValue)}>
        {formatBytesPerSecond(value)}
      </span>
    </span>
  )
}

function DiskPopoverContent({ disks }: { disks: TerminalStatusDisk[] }) {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <table className={styles.diskTable}>
      <thead>
        <tr>
          <th className={styles.diskHeader}>{t('status.diskName')}</th>
          <th className={styles.diskHeader}>{t('status.mountPoint')}</th>
          <th className={styles.diskHeader}>{t('status.totalSize')}</th>
          <th className={styles.diskHeader}>{t('status.freeSize')}</th>
        </tr>
      </thead>
      <tbody>
        {disks.map(disk => (
          <tr key={disk.id}>
            <td className={styles.diskCell}>{disk.name}</td>
            <td className={styles.diskCell}>{disk.mountPoint}</td>
            <td className={styles.diskCell}>{formatBytes(disk.totalBytes)}</td>
            <td className={styles.diskCell}>{formatBytes(disk.freeBytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function TerminalStatusBar({
  terminalViewMode,
  onTerminalViewModeChange,
}: TerminalStatusBarProps) {
  const styles = useStyles()
  const { t } = useTranslation()
  const {
    activeTerminalSession,
    focusActiveTerminal,
    writeToActiveTerminal,
  } = useWorkspaceRuntime()
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const speechRecognitionConstructor = useMemo(() => getSpeechRecognitionConstructor(), [])
  const { cpuHistory, error, memoryHistory, sample } = useTerminalStatus(
    activeTerminalSession?.sessionId ?? null,
  )

  const disks = sample?.disks ?? []
  const primaryDisk = sample?.primaryDisk ?? null
  const diskLabel = useMemo(() => {
    if (!primaryDisk) return t('status.unavailable')
    return `${primaryDisk.mountPoint} ${formatPercent(primaryDisk.usagePercent)}`
  }, [primaryDisk, t])

  const handleVoiceInputClick = useCallback(() => {
    if (!activeTerminalSession || !speechRecognitionConstructor) return

    if (isVoiceInputActive) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new speechRecognitionConstructor()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = navigator.language || 'en-US'
    recognition.onresult = event => {
      let transcript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result?.isFinal) {
          transcript += result[0]?.transcript ?? ''
        }
      }

      if (transcript) {
        writeToActiveTerminal(transcript)
      }
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }
      setIsVoiceInputActive(false)
      focusActiveTerminal()
    }
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }
      setIsVoiceInputActive(false)
      focusActiveTerminal()
    }

    recognitionRef.current = recognition
    setIsVoiceInputActive(true)
    focusActiveTerminal()
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsVoiceInputActive(false)
      focusActiveTerminal()
    }
  }, [
    activeTerminalSession,
    focusActiveTerminal,
    isVoiceInputActive,
    speechRecognitionConstructor,
    writeToActiveTerminal,
  ])

  const handleMaximizeClick = useCallback(() => {
    onTerminalViewModeChange(terminalViewMode === 'maximized' ? 'normal' : 'maximized')
    window.requestAnimationFrame(() => focusActiveTerminal())
  }, [focusActiveTerminal, onTerminalViewModeChange, terminalViewMode])

  const handleFullscreenClick = useCallback(() => {
    onTerminalViewModeChange(terminalViewMode === 'fullscreen' ? 'normal' : 'fullscreen')
    window.requestAnimationFrame(() => focusActiveTerminal())
  }, [focusActiveTerminal, onTerminalViewModeChange, terminalViewMode])

  useEffect(() => () => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // 语音识别状态由浏览器维护，停止失败时只清理本地引用。
    }
    recognitionRef.current = null
  }, [])

  const hasActiveTerminal = Boolean(activeTerminalSession)
  const canToggleTerminalView = hasActiveTerminal || terminalViewMode !== 'normal'
  const isMaximized = terminalViewMode === 'maximized'
  const isFullscreen = terminalViewMode === 'fullscreen'
  const voiceInputLabel = !speechRecognitionConstructor
    ? t('status.voiceInputUnsupported')
    : isVoiceInputActive
      ? t('status.voiceInputActive')
      : t('status.voiceInput')
  const maximizeLabel = isMaximized ? t('status.exitZoomTerminal') : t('status.zoomTerminal')
  const fullscreenLabel = isFullscreen ? t('status.exitFullscreenTerminal') : t('status.fullscreenTerminal')

  const actionButtons = (
    <div className={styles.actionsGroup}>
      <Tooltip content={voiceInputLabel} relationship="label">
        <Button
          appearance="subtle"
          aria-pressed={isVoiceInputActive}
          className={mergeClasses(styles.actionButton, isVoiceInputActive ? styles.actionButtonActive : undefined)}
          disabled={!hasActiveTerminal || !speechRecognitionConstructor}
          icon={speechRecognitionConstructor ? <MicRegular /> : <MicOffRegular />}
          onClick={handleVoiceInputClick}
          size="small"
          title={voiceInputLabel}
          type="button"
        />
      </Tooltip>
      <Tooltip content={maximizeLabel} relationship="label">
        <Button
          appearance="subtle"
          aria-pressed={isMaximized}
          className={mergeClasses(styles.actionButton, isMaximized ? styles.actionButtonActive : undefined)}
          disabled={!canToggleTerminalView}
          icon={isMaximized ? <ArrowMinimizeRegular /> : <ArrowMaximizeRegular />}
          onClick={handleMaximizeClick}
          size="small"
          title={maximizeLabel}
          type="button"
        />
      </Tooltip>
      <Tooltip content={fullscreenLabel} relationship="label">
        <Button
          appearance="subtle"
          aria-pressed={isFullscreen}
          className={mergeClasses(styles.actionButton, isFullscreen ? styles.actionButtonActive : undefined)}
          disabled={!canToggleTerminalView}
          icon={isFullscreen ? <FullScreenMinimizeRegular /> : <FullScreenMaximizeRegular />}
          onClick={handleFullscreenClick}
          size="small"
          title={fullscreenLabel}
          type="button"
        />
      </Tooltip>
    </div>
  )

  let metricsContent: ReactNode
  if (!activeTerminalSession) {
    metricsContent = <span className={styles.muted}>{t('workspace.statusReady')}</span>
  } else if (error && !sample) {
    metricsContent = <span className={styles.muted}>{t('status.unavailable')}</span>
  } else {
    metricsContent = (
      <>
        <TrendMetric
          history={cpuHistory}
          label={t('status.cpu')}
          value={sample?.cpu.usagePercent}
        />
        <TrendMetric
          history={memoryHistory}
          label={t('status.memory')}
          value={sample?.memory.usagePercent}
          withDivider
        />
        <SpeedMetric
          icon={<ArrowUploadRegular />}
          label={t('status.upload')}
          value={sample?.network.uploadBytesPerSecond}
          withDivider
        />
        <SpeedMetric
          icon={<ArrowDownloadRegular />}
          label={t('status.download')}
          value={sample?.network.downloadBytesPerSecond}
          withDivider
        />
        <SpeedMetric
          icon={<ArrowImportRegular />}
          label={t('status.diskRead')}
          value={sample?.diskIo.readBytesPerSecond}
          withDivider
        />
        <SpeedMetric
          icon={<ArrowExportRegular />}
          label={t('status.diskWrite')}
          value={sample?.diskIo.writeBytesPerSecond}
          withDivider
        />
        <Popover openOnHover positioning="above-end" withArrow>
          <PopoverTrigger disableButtonEnhancement>
            <button className={mergeClasses(styles.diskButton, styles.itemDivider)} type="button">
              <span className={styles.icon}><HardDriveRegular /></span>
              <span className={mergeClasses(styles.metricValue, styles.diskValue)}>
                {diskLabel}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverSurface className={styles.popoverSurface}>
            {disks.length > 0
              ? <DiskPopoverContent disks={disks} />
              : <span className={styles.muted}>{t('status.unavailable')}</span>}
          </PopoverSurface>
        </Popover>
      </>
    )
  }

  if (!activeTerminalSession) {
    return (
      <div className={styles.root}>
        <div className={styles.metricsGroup}>{metricsContent}</div>
        {actionButtons}
      </div>
    )
  }

  return (
    <div className={styles.root} title={activeTerminalSession.shellName}>
      <div className={styles.metricsGroup}>{metricsContent}</div>
      {actionButtons}
    </div>
  )
}
