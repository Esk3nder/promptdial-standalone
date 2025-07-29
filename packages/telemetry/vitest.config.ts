import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts']
    }
  },
  resolve: {
    alias: {
      '@promptdial/shared': path.resolve(__dirname, '../shared/src')
    }
  }
})