import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@promptdial/shared': path.resolve(__dirname, '../shared/src')
    }
  },
  test: {
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/', 'src/demo.ts'],
    },
  },
})
