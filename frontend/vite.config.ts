import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // server: {
  //   proxy: {
  //     '/api': {
  //       // target: 'https://iotlog-ws.bykonz.com',
  //       target: 'https://iotlog-ws-lb.bykonz.com',
  //       // VITE_URI_BASE=https://iotlog-ws.bykonz.com/
  //       changeOrigin: true,
  //       secure: true,
  //       configure: (proxy, _options) => {
  //         proxy.on('proxyReq', (proxyReq, _req, _res) => {
  //           proxyReq.setHeader('Origin', 'https://iotlog.bykonz.com');
  //           proxyReq.setHeader('Referer', 'https://iotlog.bykonz.com/');
  //         });
  //       },
  //     },
  //   },
  // },
  plugins: [
    devtools(),
    tanstackRouter({
      // Define o primeiro arquivo a ser acessado na rota acessada
      indexToken: 'index',
      // Ignorar as pastas com prefixo @
      routeFileIgnorePrefix: '@',
      target: 'react',
      autoCodeSplitting: true,
      semicolons: true,
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Stub out the oniguruma WASM engine — @streamdown/code already uses the JS engine.
      // Eliminates the 608 kB wasm-*.js dead chunk from the bundle.
      // shiki/dist/bundle-full.mjs dynamically imports 'shiki/wasm' (which loads wasm-inlined);
      // aliasing it to an empty stub prevents Rollup from bundling the binary.
      {
        find: /^@shikijs\/engine-oniguruma$/,
        replacement: fileURLToPath(new URL('./src/lib/engine-oniguruma-stub.ts', import.meta.url)),
      },
      {
        find: /^shiki\/wasm$/,
        replacement: fileURLToPath(new URL('./src/lib/shiki-wasm-stub.ts', import.meta.url)),
      },
    ],
  },
});
