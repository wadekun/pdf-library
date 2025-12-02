import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
    // const env = loadEnv(mode, '.', ''); // Keep this line commented out or remove if not using env vars in define
    return {
      build: {
        rollupOptions: {
          input: ['index.html', 'popup.html'],
        },
      },
      plugins: [
        react(),
        crx({ manifest }),
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
    };
});
