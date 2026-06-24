import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        manifest: {
          name: "DzStore - SaaS POS, Inventory & Maintenance",
          short_name: "DzStore",
          description: "منصة DzStore الاحترافية لإدارة مبيعات الكاشير، الضمان، الصيانة، و المخزون للمحلات بالتكامل مع تيلغرام.",
          start_url: "/",
          display: "standalone",
          background_color: "#064e3b",
          theme_color: "#064e3b",
          orientation: "any",
          icons: [
            {
              src: "/icon.svg",
              sizes: "192x192 512x512",
              type: "image/svg+xml",
              purpose: "any maskable"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
