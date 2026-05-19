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
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

const pkg = await import('./package.json', { with: { type: 'json' } }).then(m => m.default)

function formatBuildTime(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const baseConfig = {
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_PUBLISHER__: JSON.stringify(pkg.author?.name ?? ''),
    __BUILD_TIME__: JSON.stringify(formatBuildTime()),
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['node-pty', 'ssh2'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      renderer: process.env.NODE_ENV === 'test'
        ? undefined
        : {},
    }),
  ],
}