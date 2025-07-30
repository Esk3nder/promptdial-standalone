import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types'),
      promptdial: resolve(__dirname, './src/types/promptdial.ts'),
      '@promptdial/shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          // Chart libraries (if used)
          charts: ['chart.js', 'recharts'].filter((pkg) => {
            try {
              require.resolve(pkg)
              return true
            } catch {
              return false
            }
          }),
        },
      },
    },
    // Optimize build output
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Enable source maps for debugging
    sourcemap: false, // Disable in production for smaller bundles
    // Set chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
})
