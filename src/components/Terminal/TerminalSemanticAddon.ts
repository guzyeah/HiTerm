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
  IBufferRange,
  ILink,
  ILinkProvider,
  ITheme,
  ITerminalAddon,
  Terminal,
} from '@xterm/xterm'
import type {
  TerminalSemanticDetector,
  TerminalSemanticToken,
} from './terminalSemanticTypes'

interface TerminalSemanticAddonOptions {
  detectors: TerminalSemanticDetector[]
  openExternalUrl: (url: string) => Promise<void>
}

interface DisposableLike {
  dispose: () => void
}

interface TextBoundary {
  bufferLine: number
  column: number
}

interface LineTextData {
  text: string
  startBufferLine: number
  endBufferLine: number
  startBoundaries: TextBoundary[]
  endBoundaries: TextBoundary[]
}

const MAX_SCANNED_LINE_LENGTH = 8192
const MAX_WRAPPED_LINE_COUNT = 16
const UNDERLINE_THICKNESS = 1
const UNDERLINE_BOTTOM_OFFSET_RATIO = 0.16

function isPrimaryShortcutModifier(event: MouseEvent): boolean {
  const isMacPlatform = navigator.platform.toUpperCase().includes('MAC')
  return event.ctrlKey || (isMacPlatform && event.metaKey)
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getRangeKey(token: TerminalSemanticToken): string {
  const { range } = token
  return [
    token.kind,
    token.text,
    range.start.x,
    range.start.y,
    range.end.x,
    range.end.y,
  ].join(':')
}

function rangesIntersect(a: IBufferRange, b: IBufferRange, cols: number): boolean {
  const aStart = a.start.y * cols + a.start.x
  const aEnd = a.end.y * cols + a.end.x
  const bStart = b.start.y * cols + b.start.x
  const bEnd = b.end.y * cols + b.end.x

  return aStart <= bEnd && bStart <= aEnd
}

function getThemeForeground(theme: ITheme | undefined): string {
  return theme?.foreground || '#d1d1d1'
}

function getUrlTokenHref(token: TerminalSemanticToken): string {
  if (
    typeof token.payload === 'object'
    && token.payload !== null
    && 'href' in token.payload
  ) {
    return String(token.payload.href)
  }

  return token.text
}

class TerminalSemanticLinkProvider implements ILinkProvider {
  constructor(
    private readonly terminal: Terminal,
    private readonly detectors: TerminalSemanticDetector[],
    private readonly openExternalUrl: (url: string) => Promise<void>,
  ) {}

  provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void): void {
    const tokens = collectSemanticTokensForLine(
      this.terminal,
      this.detectors,
      bufferLineNumber - 1,
    )

    if (tokens.length === 0) {
      callback(undefined)
      return
    }

    callback(tokens.map(token => this.createLink(token)))
  }

  private createLink(token: TerminalSemanticToken): ILink {
    return {
      range: token.range,
      text: token.text,
      decorations: {
        pointerCursor: true,
        underline: true,
      },
      activate: event => {
        if (token.kind !== 'url') return
        if (!isPrimaryShortcutModifier(event)) return

        const href = getUrlTokenHref(token)
        if (!isHttpUrl(href)) return

        event.preventDefault()
        event.stopPropagation()
        void this.openExternalUrl(href)
      },
    }
  }
}

class TerminalSemanticOverlay {
  private overlayElement: HTMLDivElement | null = null
  private frameId: number | null = null

  constructor(
    private readonly terminal: Terminal,
    private readonly detectors: TerminalSemanticDetector[],
  ) {}

  attach(): void {
    const screenElement = this.getScreenElement()
    if (!screenElement || this.overlayElement) return

    const overlayElement = document.createElement('div')
    overlayElement.className = 'hiterm-terminal-semantic-overlay'
    Object.assign(overlayElement.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '4',
    })

    screenElement.appendChild(overlayElement)
    this.overlayElement = overlayElement
    this.scheduleRender()
  }

  dispose(): void {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    this.overlayElement?.remove()
    this.overlayElement = null
  }

  scheduleRender(): void {
    if (this.frameId !== null) return

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null
      this.render()
    })
  }

  private render(): void {
    if (!this.overlayElement) {
      this.attach()
      return
    }

    const screenElement = this.getScreenElement()
    if (!screenElement) {
      this.overlayElement.replaceChildren()
      return
    }

    const screenRect = screenElement.getBoundingClientRect()
    if (screenRect.width <= 0 || screenRect.height <= 0) {
      this.overlayElement.replaceChildren()
      return
    }

    const cellWidth = screenRect.width / Math.max(1, this.terminal.cols)
    const cellHeight = screenRect.height / Math.max(1, this.terminal.rows)
    const tokens = collectViewportTokens(this.terminal, this.detectors)
    const fragment = document.createDocumentFragment()
    const foreground = getThemeForeground(this.terminal.options.theme)

    for (const token of tokens) {
      this.renderToken(fragment, token, cellWidth, cellHeight, foreground)
    }

    this.overlayElement.replaceChildren(fragment)
  }

  private renderToken(
    fragment: DocumentFragment,
    token: TerminalSemanticToken,
    cellWidth: number,
    cellHeight: number,
    color: string,
  ): void {
    const buffer = this.terminal.buffer.active
    const viewportStart = buffer.viewportY
    const viewportEnd = viewportStart + this.terminal.rows - 1
    const startY = token.range.start.y - 1
    const endY = token.range.end.y - 1
    const underlineBottomOffset = Math.max(
      2,
      Math.round(cellHeight * UNDERLINE_BOTTOM_OFFSET_RATIO),
    )

    for (
      let bufferLine = Math.max(startY, viewportStart);
      bufferLine <= Math.min(endY, viewportEnd);
      bufferLine += 1
    ) {
      const viewportRow = bufferLine - viewportStart
      const startX = bufferLine === startY ? token.range.start.x - 1 : 0
      const endX = bufferLine === endY ? token.range.end.x : this.terminal.cols
      const width = Math.max(0, endX - startX)
      if (width <= 0) continue

      const underlineElement = document.createElement('div')
      Object.assign(underlineElement.style, {
        position: 'absolute',
        left: `${startX * cellWidth}px`,
        top: `${(viewportRow + 1) * cellHeight - underlineBottomOffset}px`,
        width: `${width * cellWidth}px`,
        height: `${UNDERLINE_THICKNESS}px`,
        backgroundColor: color,
        opacity: '0.9',
      })
      fragment.appendChild(underlineElement)
    }
  }

  private getScreenElement(): HTMLElement | null {
    return this.terminal.element?.querySelector<HTMLElement>('.xterm-screen') ?? null
  }
}

function collectViewportTokens(
  terminal: Terminal,
  detectors: TerminalSemanticDetector[],
): TerminalSemanticToken[] {
  const buffer = terminal.buffer.active
  const tokens = new Map<string, TerminalSemanticToken>()

  for (let row = 0; row < terminal.rows; row += 1) {
    const bufferLine = buffer.viewportY + row
    for (const token of collectSemanticTokensForLine(terminal, detectors, bufferLine)) {
      tokens.set(getRangeKey(token), token)
    }
  }

  return Array.from(tokens.values())
}

function collectSemanticTokensForLine(
  terminal: Terminal,
  detectors: TerminalSemanticDetector[],
  bufferLine: number,
): TerminalSemanticToken[] {
  const lineTextData = createLogicalLineTextData(terminal, bufferLine)
  if (!lineTextData || lineTextData.text.length > MAX_SCANNED_LINE_LENGTH) return []

  const tokens = detectors
    .flatMap(detector => detector.detect(lineTextData.text, {
      cols: terminal.cols,
      startBufferLine: lineTextData.startBufferLine,
      endBufferLine: lineTextData.endBufferLine,
      resolveRange: (startIndex, length) => resolveLogicalLineRange(
        lineTextData,
        startIndex,
        length,
      ),
    }))
    .sort((a, b) => b.priority - a.priority)

  if (tokens.length <= 1) return tokens

  const acceptedTokens: TerminalSemanticToken[] = []
  for (const token of tokens) {
    if (acceptedTokens.some(acceptedToken => (
      rangesIntersect(acceptedToken.range, token.range, terminal.cols)
    ))) {
      continue
    }

    acceptedTokens.push(token)
  }

  return acceptedTokens
}

function createLogicalLineTextData(terminal: Terminal, bufferLine: number): LineTextData | null {
  const buffer = terminal.buffer.active
  const logicalRange = getLogicalLineRange(terminal, bufferLine)
  if (!logicalRange) return null

  const nullCell = buffer.getNullCell()
  const startBoundaries: TextBoundary[] = []
  const endBoundaries: TextBoundary[] = []
  let text = ''

  for (
    let currentBufferLine = logicalRange.startBufferLine;
    currentBufferLine <= logicalRange.endBufferLine;
    currentBufferLine += 1
  ) {
    const line = buffer.getLine(currentBufferLine)
    if (!line) continue

    const maxColumn = Math.min(line.length, terminal.cols)
    for (let column = 0; column < maxColumn; column += 1) {
      const cell = line.getCell(column, nullCell)
      if (!cell || cell.getWidth() === 0) continue

      const chars = cell.getChars() || ' '
      const startIndex = text.length
      const startBoundary = { bufferLine: currentBufferLine, column }

      for (let offset = 0; offset < chars.length; offset += 1) {
        startBoundaries[startIndex + offset] = startBoundary
      }

      text += chars
      endBoundaries[text.length] = {
        bufferLine: currentBufferLine,
        column: column + Math.max(1, cell.getWidth()),
      }
    }
  }

  const trimmedText = text.trimEnd()
  if (!trimmedText) return null

  return {
    text: trimmedText,
    startBufferLine: logicalRange.startBufferLine,
    endBufferLine: logicalRange.endBufferLine,
    startBoundaries,
    endBoundaries,
  }
}

function resolveLogicalLineRange(
  lineTextData: LineTextData,
  startIndex: number,
  length: number,
): IBufferRange | null {
  const endIndex = startIndex + length
  const startBoundary = lineTextData.startBoundaries[startIndex]
  const endBoundary = lineTextData.endBoundaries[endIndex]

  if (
    !startBoundary
    || !endBoundary
    || (
      startBoundary.bufferLine === endBoundary.bufferLine
      && endBoundary.column <= startBoundary.column
    )
  ) {
    return null
  }

  return {
    start: {
      x: startBoundary.column + 1,
      y: startBoundary.bufferLine + 1,
    },
    end: {
      x: endBoundary.column,
      y: endBoundary.bufferLine + 1,
    },
  }
}

function getLogicalLineRange(
  terminal: Terminal,
  bufferLine: number,
): { startBufferLine: number; endBufferLine: number } | null {
  const buffer = terminal.buffer.active
  if (!buffer.getLine(bufferLine)) return null

  let startBufferLine = bufferLine
  let wrappedLineCount = 1

  while (
    startBufferLine > 0
    && wrappedLineCount < MAX_WRAPPED_LINE_COUNT
    && buffer.getLine(startBufferLine)?.isWrapped
  ) {
    startBufferLine -= 1
    wrappedLineCount += 1
  }

  let endBufferLine = bufferLine
  while (wrappedLineCount < MAX_WRAPPED_LINE_COUNT) {
    const nextLine = buffer.getLine(endBufferLine + 1)
    if (!nextLine?.isWrapped) break

    endBufferLine += 1
    wrappedLineCount += 1
  }

  return { startBufferLine, endBufferLine }
}

export class TerminalSemanticAddon implements ITerminalAddon {
  private overlay: TerminalSemanticOverlay | null = null
  private disposables: DisposableLike[] = []

  constructor(private readonly options: TerminalSemanticAddonOptions) {}

  activate(terminal: Terminal): void {
    const previousLinkHandler = terminal.options.linkHandler ?? null

    this.overlay = new TerminalSemanticOverlay(terminal, this.options.detectors)
    this.overlay.attach()

    this.disposables = [
      terminal.registerLinkProvider(new TerminalSemanticLinkProvider(
        terminal,
        this.options.detectors,
        this.options.openExternalUrl,
      )),
      terminal.onRender(() => this.overlay?.scheduleRender()),
      terminal.onScroll(() => this.overlay?.scheduleRender()),
      terminal.onResize(() => this.overlay?.scheduleRender()),
      terminal.onWriteParsed(() => this.overlay?.scheduleRender()),
      {
        dispose: () => {
          terminal.options.linkHandler = previousLinkHandler
        },
      },
    ]

    terminal.options.linkHandler = {
      allowNonHttpProtocols: false,
      activate: (event, text) => {
        if (!isPrimaryShortcutModifier(event)) return
        if (!isHttpUrl(text)) return

        event.preventDefault()
        event.stopPropagation()
        void this.options.openExternalUrl(text)
      },
    }
  }

  dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose())
    this.disposables = []
    this.overlay?.dispose()
    this.overlay = null
  }
}
