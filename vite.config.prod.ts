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
import { defineConfig } from 'vite'
import { baseConfig } from './vite.config'

export default defineConfig({
  ...baseConfig,
  build: {
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      format: {
        comments: false,
      },
    },
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          fluentui: ['@fluentui/react-components', '@fluentui/react-icons'],
          xterm: ['@xterm/xterm', '@xterm/addon-fit'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})