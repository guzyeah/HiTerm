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
 * 批量更新 i18n 翻译文件，添加 connectDialog 命名空间
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'

const localesDir = 'src/i18n/locales'
const files = readdirSync(localesDir).filter(f => f.endsWith('.json'))

// 英文基础翻译
const enConnectDialog = {
  title: 'Connect Shell',
  host: 'Host',
  hostPlaceholder: 'Enter host address',
  port: 'Port',
  username: 'Username',
  usernamePlaceholder: 'Enter username',
  authType: 'Auth Type',
  password: 'Password',
  passwordPlaceholder: 'Enter password',
  privateKey: 'Private Key',
  privateKeyPlaceholder: 'Select private key file',
  selectPrivateKey: 'Select Private Key',
  browse: 'Browse',
  noAuth: 'None',
  terminalPath: 'Terminal Path',
  terminalPathPlaceholder: 'e.g. /bin/bash',
  workDir: 'Working Directory',
  workDirPlaceholder: 'e.g. /home/user',
  serialPort: 'Serial Port',
  serialPortPlaceholder: 'Select serial port',
  baudRate: 'Baud Rate',
  dataBits: 'Data Bits',
  parity: 'Parity',
  parityNone: 'None',
  parityEven: 'Even',
  parityOdd: 'Odd',
  stopBits: 'Stop Bits',
  flowControl: 'Flow Control',
  flowControlNone: 'None',
  flowControlRtscts: 'RTS/CTS',
  flowControlXonxoff: 'XON/XOFF',
  colorDepth: 'Color Depth',
  bits: 'bits',
  quality: 'Quality',
  qualityLow: 'Low',
  qualityMedium: 'Medium',
  qualityHigh: 'High',
  qualityAuto: 'Auto',
  domain: 'Domain',
  domainPlaceholder: 'e.g. DOMAIN',
  resolution: 'Resolution',
  name: 'Shell Name',
  namePlaceholder: 'Auto-fill or custom',
  group: 'Group',
  groupPlaceholder: 'Select or enter group',
  save: 'Save',
  saveAndConnect: 'Save & Connect'
}

// 各语言翻译映射
const translations = {
  'zh-TW': {
    title: '\u9023\u63a5 Shell',
    host: '\u4e3b\u6a5f',
    hostPlaceholder: '\u8f38\u5165\u4e3b\u6a5f\u5730\u5740',
    port: '\u7aef\u53e3',
    username: '\u7528\u6236\u540d',
    usernamePlaceholder: '\u8f38\u5165\u7528\u6236\u540d',
    authType: '\u8a8d\u8b49\u65b9\u5f0f',
    password: '\u5bc6\u78bc',
    passwordPlaceholder: '\u8f38\u5165\u5bc6\u78bc',
    privateKey: '\u79c1\u9470',
    privateKeyPlaceholder: '\u9078\u64c7\u79c1\u9470\u6587\u4ef6',
    selectPrivateKey: '\u9078\u64c7\u79c1\u9470\u6587\u4ef6',
    browse: '\u700f\u89bd',
    noAuth: '\u7121\u8a8d\u8b49',
    terminalPath: '\u7d42\u7aef\u8def\u5f91',
    terminalPathPlaceholder: '\u4f8b\u5982\uff1a/bin/bash',
    workDir: '\u5de5\u4f5c\u76ee\u9304',
    workDirPlaceholder: '\u4f8b\u5982\uff1a/home/user',
    serialPort: '\u4e32\u53e3\u865f',
    serialPortPlaceholder: '\u9078\u64c7\u4e32\u53e3',
    baudRate: '\u6ce2\u7279\u7387',
    dataBits: '\u6578\u64da\u4f4d',
    parity: '\u6821\u9a57\u4f4d',
    parityNone: '\u7121',
    parityEven: '\u5076\u6821\u9a57',
    parityOdd: '\u5947\u6821\u9a57',
    stopBits: '\u505c\u6b62\u4f4d',
    flowControl: '\u6d41\u63a7\u5236',
    flowControlNone: '\u7121',
    flowControlRtscts: 'RTS/CTS',
    flowControlXonxoff: 'XON/XOFF',
    colorDepth: '\u984f\u8272\u6df1\u5ea6',
    bits: '\u4f4d',
    quality: '\u5716\u50cf\u8cea\u91cf',
    qualityLow: '\u4f4e',
    qualityMedium: '\u4e2d',
    qualityHigh: '\u9ad8',
    qualityAuto: '\u81ea\u52d5',
    domain: '\u57df',
    domainPlaceholder: '\u4f8b\u5982\uff1aDOMAIN',
    resolution: '\u89e3\u6790\u5ea6',
    name: 'Shell\u540d\u7a31',
    namePlaceholder: '\u81ea\u52d5\u586b\u5145\u6216\u81ea\u5b9a\u7fa9',
    group: '\u5206\u7d44',
    groupPlaceholder: '\u9078\u64c7\u6216\u8f38\u5165\u5206\u7d44',
    save: '\u4fdd\u5b58',
    saveAndConnect: '\u4fdd\u5b58\u4e26\u9023\u63a5'
  }
}

for (const file of files) {
  const filePath = join(localesDir, file)
  const content = JSON.parse(readFileSync(filePath, 'utf-8'))

  if (file === 'zh-CN.json') continue

  let connectDialog
  if (file === 'en.json') {
    connectDialog = enConnectDialog
  } else {
    const langKey = file.replace('.json', '')
    connectDialog = translations[langKey] || enConnectDialog
  }

  content.connectDialog = connectDialog
  writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
  console.log('Updated: ' + file)
}

console.log('Done!')
