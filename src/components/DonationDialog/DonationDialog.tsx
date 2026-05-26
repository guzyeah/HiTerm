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
 * 捐赠渠道弹窗。
 * 二维码素材放在 public/donation，历史记录集中维护在 DONATION_RECORDS。
 */

import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import { DismissRegular } from '@fluentui/react-icons'

interface DonationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface DonationChannel {
  id: 'domestic' | 'overseas'
  titleKey: string
  channelName: string
  qrPath: string
  qrAltKey: string
}

interface DonationRecord {
  name: string
  amount: string
}

const DONATION_CHANNELS: DonationChannel[] = [
  {
    id: 'domestic',
    titleKey: 'donation.domesticTitle',
    channelName: 'WeChat Pay',
    qrPath: 'donation/wechat.jpg',
    qrAltKey: 'donation.domesticQrAlt',
  },
  {
    id: 'overseas',
    titleKey: 'donation.overseasTitle',
    channelName: 'Ko-fi',
    qrPath: 'donation/kofi.webp',
    qrAltKey: 'donation.overseasQrAlt',
  },
]

const DONATION_RECORDS: DonationRecord[] = []

function resolvePublicAsset(path: string): string {
  return new URL(path, window.location.href).toString()
}

const useStyles = makeStyles({
  surface: {
    width: '820px',
    maxWidth: 'calc(100vw - 32px)',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
  },
  channelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: tokens.spacingHorizontalL,
    '@media (max-width: 720px)': {
      gridTemplateColumns: '1fr',
    },
  },
  channelPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalM,
    minWidth: 0,
    paddingBlock: tokens.spacingVerticalL,
    paddingInline: tokens.spacingHorizontalL,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    boxSizing: 'border-box',
  },
  channelTitle: {
    margin: 0,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase400,
  },
  channelName: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  qrFrame: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '208px',
    height: '208px',
    padding: tokens.spacingHorizontalS,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxSizing: 'border-box',
  },
  qrImage: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  historySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    minWidth: 0,
  },
  historyTitle: {
    margin: 0,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '180px',
    overflowY: 'auto',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  historyRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) max-content',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    minHeight: '36px',
    paddingInline: tokens.spacingHorizontalM,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderBottomStyle: 'solid',
    borderBottomWidth: tokens.strokeWidthThin,
    boxSizing: 'border-box',
    ':last-child': {
      borderBottomWidth: 0,
    },
  },
  historyHeader: {
    minHeight: '32px',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  donorName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  donorAmount: {
    color: tokens.colorNeutralForeground2,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  emptyHistory: {
    minHeight: '56px',
    display: 'flex',
    alignItems: 'center',
    paddingInline: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    boxSizing: 'border-box',
  },
})

export const DonationDialog: FC<DonationDialogProps> = ({ open, onOpenChange }) => {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={(
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label={t('common.close')} icon={<DismissRegular />} />
              </DialogTrigger>
            )}
          >
            {t('donation.title')}
          </DialogTitle>
          <DialogContent className={styles.content}>
            <div className={styles.channelGrid}>
              {DONATION_CHANNELS.map(channel => (
                <section className={styles.channelPanel} key={channel.id}>
                  <h3 className={styles.channelTitle}>{t(channel.titleKey)}</h3>
                  <span className={styles.channelName}>{channel.channelName}</span>
                  <div className={styles.qrFrame}>
                    <img
                      alt={t(channel.qrAltKey)}
                      className={styles.qrImage}
                      src={resolvePublicAsset(channel.qrPath)}
                    />
                  </div>
                </section>
              ))}
            </div>

            <section className={styles.historySection}>
              <h3 className={styles.historyTitle}>{t('donation.historyTitle')}</h3>
              <div className={styles.historyList}>
                <div className={mergeClasses(styles.historyRow, styles.historyHeader)}>
                  <span>{t('donation.donorName')}</span>
                  <span>{t('donation.amount')}</span>
                </div>
                {DONATION_RECORDS.length > 0 ? (
                  DONATION_RECORDS.map(record => (
                    <div className={styles.historyRow} key={`${record.name}:${record.amount}`}>
                      <span className={styles.donorName}>{record.name}</span>
                      <span className={styles.donorAmount}>{record.amount}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyHistory}>{t('donation.emptyHistory')}</div>
                )}
              </div>
            </section>
          </DialogContent>
          <DialogActions>
            <DialogTrigger action="close">
              <Button appearance="primary">{t('common.close')}</Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
