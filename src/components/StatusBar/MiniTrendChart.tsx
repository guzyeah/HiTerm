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
import { makeStyles, tokens } from '@fluentui/react-components'

interface MiniTrendChartProps {
  values: Array<number | null>
}

const CHART_WIDTH = 46
const CHART_HEIGHT = 16

const useStyles = makeStyles({
  root: {
    display: 'block',
    flexShrink: 0,
    width: `${CHART_WIDTH}px`,
    height: `${CHART_HEIGHT}px`,
  },
})

function normalizeValues(values: Array<number | null>): number[] {
  const nextValues = values.slice(-10).map(value => (
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : 0
  ))

  while (nextValues.length < 2) {
    nextValues.unshift(0)
  }

  return nextValues
}

function getPoint(value: number, index: number, count: number): string {
  const x = count === 1 ? 0 : (index / (count - 1)) * CHART_WIDTH
  const y = CHART_HEIGHT - (value / 100) * CHART_HEIGHT
  return `${x.toFixed(2)},${y.toFixed(2)}`
}

export function MiniTrendChart({ values }: MiniTrendChartProps) {
  const styles = useStyles()
  const normalizedValues = normalizeValues(values)
  const points = normalizedValues.map((value, index) => getPoint(value, index, normalizedValues.length))
  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${CHART_WIDTH},${CHART_HEIGHT} L 0,${CHART_HEIGHT} Z`

  return (
    <svg
      aria-hidden="true"
      className={styles.root}
      focusable="false"
      role="img"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
    >
      <path d={areaPath} fill={tokens.colorBrandBackground} opacity="0.18" />
      <path
        d={linePath}
        fill="none"
        stroke={tokens.colorBrandBackground}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}
