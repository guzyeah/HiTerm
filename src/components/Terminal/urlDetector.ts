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
import type {
  TerminalSemanticDetector,
  TerminalSemanticToken,
} from './terminalSemanticTypes'

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`\\|{}[\]^]+/giu
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?]+$/u
const MAX_URL_LENGTH = 4096

function getSafeHttpUrl(value: string): string | null {
  if (!value || value.length > MAX_URL_LENGTH) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function trimUnbalancedClosingBrackets(value: string): string {
  let nextValue = value

  while (nextValue.endsWith(')')) {
    const openingCount = (nextValue.match(/\(/gu) ?? []).length
    const closingCount = (nextValue.match(/\)/gu) ?? []).length
    if (closingCount <= openingCount) break
    nextValue = nextValue.slice(0, -1)
  }

  while (nextValue.endsWith(']')) {
    const openingCount = (nextValue.match(/\[/gu) ?? []).length
    const closingCount = (nextValue.match(/\]/gu) ?? []).length
    if (closingCount <= openingCount) break
    nextValue = nextValue.slice(0, -1)
  }

  return nextValue
}

function trimUrlCandidate(value: string): string {
  return trimUnbalancedClosingBrackets(
    value.replace(TRAILING_PUNCTUATION_PATTERN, ''),
  )
}

export const urlDetector: TerminalSemanticDetector = {
  kind: 'url',
  detect(text, context): TerminalSemanticToken<'url'>[] {
    const tokens: TerminalSemanticToken<'url'>[] = []

    URL_PATTERN.lastIndex = 0
    for (const match of text.matchAll(URL_PATTERN)) {
      const rawValue = match[0]
      const startIndex = match.index ?? 0
      const candidate = trimUrlCandidate(rawValue)
      const href = getSafeHttpUrl(candidate)
      if (!href) continue
      const range = context.resolveRange(startIndex, candidate.length)
      if (!range) continue

      tokens.push({
        kind: 'url',
        text: candidate,
        priority: 100,
        payload: { href },
        range,
      })
    }

    return tokens
  },
}
