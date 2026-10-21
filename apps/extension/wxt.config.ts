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
    // Sin `tabs`: la URL solo se lee en pestañas con host permission (YouTube), no del resto (FR-012).
    permissions: ['sidePanel', 'storage'],
    host_permissions: ['*://*.youtube.com/*', `${new URL(apiUrl).origin}/*`],
    action: { default_title: 'Abrir Polifamia' },
    // CSP explícita de MV3: solo scripts propios, sin eval ni orígenes remotos.
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  },
});
