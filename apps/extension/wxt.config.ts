import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const apiUrl = process.env.WXT_API_URL ?? 'http://localhost:3100';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Polifamia — investigar afirmaciones',
    description:
      'Investiga afirmaciones de vídeos de YouTube con fuentes verificables. Solo actúa cuando abres el panel.',
    permissions: ['sidePanel', 'storage', 'tabs'],
    host_permissions: ['*://*.youtube.com/*', `${new URL(apiUrl).origin}/*`],
    action: { default_title: 'Abrir Polifamia' },
  },
});
