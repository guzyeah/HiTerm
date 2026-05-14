/**
 * 历史命令面板。
 * 只展示当前 session 的命令历史，并提供复制、删除、再次执行操作。
 */

import { useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Input,
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowClockwiseRegular,
  CopyRegular,
  DeleteRegular,
  SearchRegular,
} from '@fluentui/react-icons'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { useTerminalHistory } from '@/hooks/useTerminalHistory'
import { PROTOCOL_ICON_MAP } from '@/shared/protocolIcons'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    gap: tokens.spacingVerticalXS,
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    flexShrink: 0,
  },
  sessionBanner: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '28px',
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  searchInput: {
    width: '100%',
  },
  list: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '72px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
    paddingInline: tokens.spacingHorizontalS,
  },
  record: {
    display: 'grid',
    gridTemplateColumns: '16px minmax(0, 1fr) auto',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
    paddingInline: tokens.spacingHorizontalXS,
    paddingBlock: '4px',
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid transparent`,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'background-color 120ms ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  recordIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  command: {
    display: 'block',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    opacity: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
    transition: 'opacity 120ms ease, visibility 120ms ease',
  },
  actionGroupVisible: {
    opacity: 1,
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  actionButton: {
    width: '24px',
    minWidth: '24px',
    height: '24px',
    padding: 0,
    flexShrink: 0,
  },
  tooltipContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    maxWidth: '420px',
  },
  tooltipCommand: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground1,
  },
  tooltipTimestamp: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
    lineHeight: tokens.lineHeightBase100,
    fontVariantNumeric: 'tabular-nums',
  },
})

export const HistoryPanel: FC = () => {
  const styles = useStyles()
  const { t, i18n } = useTranslation()
  const { activeTerminalSession } = useWorkspaceRuntime()
  const sessionId = activeTerminalSession?.sessionId ?? null
  const { records, isLoading, error, deleteRecord } = useTerminalHistory(sessionId)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredRecordId, setHoveredRecordId] = useState<string | null>(null)

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), [i18n.resolvedLanguage])

  const filteredRecords = useMemo(() => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase()
    if (!normalizedSearchQuery) return records

    return records.filter(record => (
      record.command.toLowerCase().includes(normalizedSearchQuery)
    ))
  }, [records, searchQuery])

  const emptyStateText = useMemo(() => {
    if (searchQuery.trim()) {
      return t('activityBar.historyEmptySearch')
    }

    return t('activityBar.historyEmptySession')
  }, [searchQuery, t])

  const handleCopy = async (command: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
    } catch {
      // 复制失败时保持静默，避免打断命令历史浏览。
    }
  }

  const handleRerun = (command: string): void => {
    if (!sessionId || !window.terminalAPI) return

    void window.terminalAPI.write({
      sessionId,
      data: `${command}\r`,
    })
  }

  if (!activeTerminalSession) {
    return <div className={styles.status}>{t('activityBar.historyNoSession')}</div>
  }

  if (error && records.length === 0) {
    return <div className={styles.status}>{error}</div>
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.sessionBanner} title={activeTerminalSession.shellName}>
          {t('activityBar.historyCurrentSession')}: {activeTerminalSession.shellName}
        </div>
        <Input
          className={styles.searchInput}
          contentBefore={<SearchRegular />}
          onChange={(_, data) => setSearchQuery(data.value)}
          placeholder={t('activityBar.historySearchPlaceholder')}
          size="small"
          value={searchQuery}
        />
      </div>

      <div className={styles.list}>
        {isLoading && records.length === 0 ? (
          <div className={styles.status}>{t('activityBar.historyLoading')}</div>
        ) : filteredRecords.length === 0 ? (
          <div className={styles.status}>{emptyStateText}</div>
        ) : (
          filteredRecords.map(record => {
            const isHovered = hoveredRecordId === record.id

            return (
              <Tooltip
                content={(
                  <div className={styles.tooltipContent}>
                    <pre className={styles.tooltipCommand}>{record.command}</pre>
                    <time className={styles.tooltipTimestamp} dateTime={record.executedAt}>
                      {dateFormatter.format(new Date(record.executedAt))}
                    </time>
                  </div>
                )}
                key={record.id}
                positioning="above-start"
                relationship="description"
                withArrow
              >
                <div
                  className={styles.record}
                  onMouseEnter={() => setHoveredRecordId(record.id)}
                  onMouseLeave={() => setHoveredRecordId(current => (current === record.id ? null : current))}
                >
                  <span className={styles.recordIcon}>{PROTOCOL_ICON_MAP[record.protocol]}</span>
                  <code className={styles.command}>
                    {record.command}
                  </code>
                  <div className={mergeClasses(
                    styles.actionGroup,
                    isHovered ? styles.actionGroupVisible : undefined,
                  )}>
                    <Button
                      aria-label={t('activityBar.historyCopyCommand')}
                      appearance="subtle"
                      className={styles.actionButton}
                      icon={<CopyRegular />}
                      onClick={() => void handleCopy(record.command)}
                      size="small"
                      title={t('activityBar.historyCopyCommand')}
                    />
                    <Button
                      aria-label={t('activityBar.historyRerunCommand')}
                      appearance="subtle"
                      className={styles.actionButton}
                      icon={<ArrowClockwiseRegular />}
                      onClick={() => handleRerun(record.command)}
                      size="small"
                      title={t('activityBar.historyRerunCommand')}
                    />
                    <Button
                      aria-label={t('activityBar.historyDeleteCommand')}
                      appearance="subtle"
                      className={styles.actionButton}
                      icon={<DeleteRegular />}
                      onClick={() => void deleteRecord(record.id)}
                      size="small"
                      title={t('activityBar.historyDeleteCommand')}
                    />
                  </div>
                </div>
              </Tooltip>
            )
          })
        )}
      </div>
    </div>
  )
}
