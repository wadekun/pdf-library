import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig(({ mode }) => {
    // const env = loadEnv(mode, '.', ''); // Keep this line commented out or remove if not using env vars in define
    return {
      build: {
        rollupOptions: {
          input: ['index.html', 'popup.html'],
          output: {
            // 确保 worker 文件正确输出
            manualChunks: {
              vendor: ['react', 'react-dom'],
              pdf: ['react-pdf', 'pdfjs-dist'],
            },
          },
        },
      },
      plugins: [
        react(),
        // crx 插件应该放在最后，因为它会接管 HTML 入口处理
        crx({ manifest }),
      ],
      // optimizeDeps 配置
      optimizeDeps: {
        include: [
          'react-pdf',
          'pdfjs-dist',
        ],
      },
      // 确保 worker 文件能被正确处理
      worker: {
        format: 'es',
        rollupOptions: {
          output: {
            entryFileNames: `assets/[name].js`,
            chunkFileNames: `assets/[name].js`,
            assetFileNames: `assets/[name][extname]`
          }
        }
      },
      server: {
        port: 5173,
        strictPort: true,
        hmr: {
          port: 5173,
        },
      },
    };
});
