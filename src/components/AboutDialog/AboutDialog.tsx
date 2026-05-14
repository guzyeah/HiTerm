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
 * 关于对话框组件
 * 以k-v表格形式展示应用基本信息和运行时渲染信息
 * k列居右不折行，v列居左可折行，分割线分隔基本信息与运行时信息
 */

import { useEffect, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  Divider,
  Button,
} from '@fluentui/react-components'
import { detectActualRenderedFont } from '@/utils/fontDetector'
import { detectRenderEngine } from '@/utils/renderEngineDetector'

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** k-v行组件 */
function KvRow({ keyText, valueText }: { keyText: string; valueText: string }) {
  return (
    <>
      <div className="about-key">{keyText}</div>
      <div className="about-value">{valueText}</div>
    </>
  )
}

export const AboutDialog: FC<AboutDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation()
  const [renderEngine, setRenderEngine] = useState<string>('')
  const [renderFont, setRenderFont] = useState<string>('')

  useEffect(() => {
    if (open) {
      const engine = detectRenderEngine()
      setRenderEngine(engine === 'gpu' ? t('about.renderEngine.gpu') : t('about.renderEngine.cpu'))
      setRenderFont(detectActualRenderedFont())
    }
  }, [open, t])

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface style={{ width: '500px', minHeight: '300px' }}>
        <DialogBody>
          <DialogTitle
            action={(
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label={t('common.close')} icon={<span aria-hidden="true">×</span>} />
              </DialogTrigger>
            )}
          >
            {t('about.title')}
          </DialogTitle>
          <DialogContent>
            <div className="about-table">
              <KvRow keyText={t('about.appName')} valueText={__APP_VERSION__ ? 'HiTerm' : t('app.name')} />
              <KvRow keyText={t('about.appVersion')} valueText={__APP_VERSION__} />
              <KvRow keyText={t('about.publisher')} valueText={__APP_PUBLISHER__} />
              <KvRow keyText={t('about.releaseTime')} valueText={__BUILD_TIME__} />
              <div className="about-separator">
                <Divider />
              </div>
              <KvRow keyText={t('about.renderEngineLabel')} valueText={renderEngine} />
              <KvRow keyText={t('about.renderFont')} valueText={renderFont} />
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
