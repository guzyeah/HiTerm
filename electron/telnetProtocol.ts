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
 * Telnet 协议协商与数据净化。
 * 只保留终端可显示数据，协商响应直接写回原始 socket。
 */

const IAC = 255
const SE = 240
const SB = 250
const WILL = 251
const WONT = 252
const DO = 253
const DONT = 254

const OPTION_BINARY = 0
const OPTION_ECHO = 1
const OPTION_SUPPRESS_GO_AHEAD = 3
const OPTION_TERMINAL_TYPE = 24
const OPTION_NAWS = 31

const TERMINAL_TYPE_IS = 0
const TERMINAL_TYPE_SEND = 1

type TelnetParserState =
  | 'data'
  | 'iac'
  | 'will'
  | 'wont'
  | 'do'
  | 'dont'
  | 'subnegotiationOption'
  | 'subnegotiationData'
  | 'subnegotiationIac'

export interface TelnetProtocolHandlerOptions {
  cols: number
  rows: number
  terminalType?: string
  writeRaw: (data: Buffer) => void
}

function normalizeDimension(value: number, fallback: number): number {
  const normalizedValue = Math.floor(value)
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) return fallback

  return Math.min(65535, normalizedValue)
}

function appendTelnetEscapedByte(target: number[], value: number): void {
  target.push(value)
  if (value === IAC) {
    target.push(IAC)
  }
}

function escapeIacBytes(data: Buffer): Buffer {
  if (!data.includes(IAC)) return data

  const escapedBytes: number[] = []
  data.forEach(byte => appendTelnetEscapedByte(escapedBytes, byte))
  return Buffer.from(escapedBytes)
}

export class TelnetProtocolHandler {
  private cols: number
  private rows: number
  private readonly terminalType: string
  private readonly writeRaw: (data: Buffer) => void
  private state: TelnetParserState = 'data'
  private subnegotiationOption: number | null = null
  private subnegotiationData: number[] = []
  private isNawsEnabled = false

  constructor(options: TelnetProtocolHandlerOptions) {
    this.cols = normalizeDimension(options.cols, 80)
    this.rows = normalizeDimension(options.rows, 24)
    this.terminalType = options.terminalType ?? 'xterm-256color'
    this.writeRaw = options.writeRaw
  }

  start(): void {
    this.sendCommand(WILL, OPTION_TERMINAL_TYPE)
    this.sendCommand(WILL, OPTION_NAWS)
    this.sendCommand(DO, OPTION_SUPPRESS_GO_AHEAD)
    this.sendCommand(WILL, OPTION_SUPPRESS_GO_AHEAD)
  }

  parse(chunk: Buffer): Buffer {
    const outputBytes: number[] = []

    chunk.forEach(byte => {
      switch (this.state) {
        case 'data':
          this.handleDataByte(byte, outputBytes)
          break
        case 'iac':
          this.handleIacByte(byte, outputBytes)
          break
        case 'will':
          this.handleWill(byte)
          this.state = 'data'
          break
        case 'wont':
          this.handleWont(byte)
          this.state = 'data'
          break
        case 'do':
          this.handleDo(byte)
          this.state = 'data'
          break
        case 'dont':
          this.handleDont(byte)
          this.state = 'data'
          break
        case 'subnegotiationOption':
          this.subnegotiationOption = byte
          this.subnegotiationData = []
          this.state = 'subnegotiationData'
          break
        case 'subnegotiationData':
          this.handleSubnegotiationByte(byte)
          break
        case 'subnegotiationIac':
          this.handleSubnegotiationIacByte(byte)
          break
        default:
          this.state = 'data'
      }
    })

    return Buffer.from(outputBytes)
  }

  encodeInput(data: string): Buffer {
    return escapeIacBytes(Buffer.from(data, 'utf8'))
  }

  resize(cols: number, rows: number): void {
    this.cols = normalizeDimension(cols, this.cols)
    this.rows = normalizeDimension(rows, this.rows)

    if (this.isNawsEnabled) {
      this.sendNaws()
    }
  }

  private handleDataByte(byte: number, outputBytes: number[]): void {
    if (byte === IAC) {
      this.state = 'iac'
      return
    }

    outputBytes.push(byte)
  }

  private handleIacByte(byte: number, outputBytes: number[]): void {
    if (byte === IAC) {
      outputBytes.push(IAC)
      this.state = 'data'
      return
    }

    if (byte === WILL) {
      this.state = 'will'
      return
    }

    if (byte === WONT) {
      this.state = 'wont'
      return
    }

    if (byte === DO) {
      this.state = 'do'
      return
    }

    if (byte === DONT) {
      this.state = 'dont'
      return
    }

    if (byte === SB) {
      this.state = 'subnegotiationOption'
      return
    }

    this.state = 'data'
  }

  private handleSubnegotiationByte(byte: number): void {
    if (byte === IAC) {
      this.state = 'subnegotiationIac'
      return
    }

    this.subnegotiationData.push(byte)
  }

  private handleSubnegotiationIacByte(byte: number): void {
    if (byte === IAC) {
      this.subnegotiationData.push(IAC)
      this.state = 'subnegotiationData'
      return
    }

    if (byte === SE) {
      this.handleSubnegotiation()
      this.subnegotiationOption = null
      this.subnegotiationData = []
      this.state = 'data'
      return
    }

    this.state = 'subnegotiationData'
  }

  private handleWill(option: number): void {
    if (option === OPTION_ECHO || option === OPTION_SUPPRESS_GO_AHEAD || option === OPTION_BINARY) {
      this.sendCommand(DO, option)
      return
    }

    this.sendCommand(DONT, option)
  }

  private handleWont(option: number): void {
    this.sendCommand(DONT, option)
  }

  private handleDo(option: number): void {
    if (option === OPTION_NAWS) {
      this.isNawsEnabled = true
      this.sendCommand(WILL, option)
      this.sendNaws()
      return
    }

    if (
      option === OPTION_TERMINAL_TYPE
      || option === OPTION_SUPPRESS_GO_AHEAD
      || option === OPTION_BINARY
    ) {
      this.sendCommand(WILL, option)
      return
    }

    this.sendCommand(WONT, option)
  }

  private handleDont(option: number): void {
    if (option === OPTION_NAWS) {
      this.isNawsEnabled = false
    }

    this.sendCommand(WONT, option)
  }

  private handleSubnegotiation(): void {
    if (
      this.subnegotiationOption === OPTION_TERMINAL_TYPE
      && this.subnegotiationData[0] === TERMINAL_TYPE_SEND
    ) {
      this.sendTerminalType()
    }
  }

  private sendCommand(command: number, option: number): void {
    this.writeRaw(Buffer.from([IAC, command, option]))
  }

  private sendSubnegotiation(option: number, data: number[]): void {
    const payload = [IAC, SB, option]
    data.forEach(byte => appendTelnetEscapedByte(payload, byte))
    payload.push(IAC, SE)
    this.writeRaw(Buffer.from(payload))
  }

  private sendTerminalType(): void {
    this.sendSubnegotiation(OPTION_TERMINAL_TYPE, [
      TERMINAL_TYPE_IS,
      ...Buffer.from(this.terminalType, 'ascii'),
    ])
  }

  private sendNaws(): void {
    const cols = normalizeDimension(this.cols, 80)
    const rows = normalizeDimension(this.rows, 24)

    this.sendSubnegotiation(OPTION_NAWS, [
      (cols >> 8) & 0xff,
      cols & 0xff,
      (rows >> 8) & 0xff,
      rows & 0xff,
    ])
  }
}
