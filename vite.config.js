import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createFascinLeadApi } from './server/fascinlead-api.js';
import { createSavwinLocalProxy } from './server/savwin-local-proxy.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = mode === 'staging' ? 'LeadFlow Test' : 'LeadFlow';
  return ({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              maxSize: 350000,
              priority: 20
            },
            {
              name: 'lucide',
              test: /node_modules[\\/]lucide[\\/]/,
              priority: 20
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10
            }
          ]
        }
      }
    }
  },
  plugins: [
    {
      name: 'leadflow-branding',
      transformIndexHtml(html) {
        return html.replace(/<title>.*?<\/title>/, `<title>${appName}</title>`);
      }
    },
    createFascinLeadApi(env),
    createSavwinLocalProxy(env),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'leadflow-logo.png'],
      manifest: {
        name: appName,
        short_name: appName,
        description: 'Captacao, relacionamento e agendamento de clientes.',
        theme_color: '#003070',
        background_color: '#f4f6f9',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: []
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js']
  }
  });
});
