import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PDF Library',
        short_name: 'PDFLib',
        description: '一个本地 PDF 图书管理器和阅读器。',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'icons/icon128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'icons/icon48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'icons/icon32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'icons/icon16.png',
            sizes: '16x16',
            type: 'image/png'
          }
        ]
      }
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
          dest: '.'
        }
      ]
    })
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
