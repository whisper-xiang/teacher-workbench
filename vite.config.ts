import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { attachRssProxy } from './vite-rss-proxy.js'

function rssProxyPlugin(): Plugin {
  return {
    name: 'rss-proxy',
    configureServer(server) {
      attachRssProxy(server)
    },
    configurePreviewServer(server) {
      attachRssProxy(server)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), rssProxyPlugin()],
  resolve: {
    alias: {
      '@fluentui/react-icons': fileURLToPath(new URL('./src/fluent-icons.tsx', import.meta.url)),
    },
  },
})
