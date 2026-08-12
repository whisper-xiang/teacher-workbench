import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fluentui/react-icons': fileURLToPath(new URL('./src/fluent-icons.tsx', import.meta.url)),
    },
  },
})
