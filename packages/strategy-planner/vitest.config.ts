import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'src/demo.ts',
        'dist/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@promptdial/shared': resolve(__dirname, './tests/mocks/shared.ts')
    }
  }
});