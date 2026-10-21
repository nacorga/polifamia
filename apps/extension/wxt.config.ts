import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const apiUrl = process.env.WXT_API_URL ?? 'http://localhost:3100';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Polifamia — investigar afirmaciones',
    description:
      'Investiga afirmaciones de artículos y vídeos de YouTube con fuentes verificables. Solo actúa cuando la invocas.',
    // Sin `tabs`: la URL solo se lee en YouTube (host permission) o en la pestaña donde se invoca el menú
    // contextual (`activeTab`, temporal); nunca del resto (FR-012 de 001, FR-003 de 002).
    permissions: ['activeTab', 'contextMenus', 'sidePanel', 'storage'],
    host_permissions: ['*://*.youtube.com/*', `${new URL(apiUrl).origin}/*`],
    action: { default_title: 'Abrir Polifamia' },
    // CSP explícita de MV3: solo scripts propios, sin eval ni orígenes remotos.
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  },
});
