// Módulo puro (sin APIs del navegador): lo usan el background y los tests E2E en Node.

/** Selección de una página tal como la ve el panel. Nada de esto sale del navegador salvo el texto. */
export type PageSelection =
  | { text: string; url: string; domain: string; title: string; at: string }
  | { unsupported: true; at: string };

export const selectionKey = (tabId: number) => `selection:${tabId}`;

/**
 * Convierte el clic del menú contextual en la selección del panel: dirección reducida a origen y ruta
 * (sin parámetros ni fragmento, SC-006), texto con espacios normalizados. Las páginas que no son
 * http(s) o son PDFs se marcan como no compatibles (FR-014).
 */
export function selectionFromClick(
  info: { selectionText?: string; pageUrl?: string },
  tab?: { title?: string },
  now = new Date(),
): PageSelection {
  const at = now.toISOString();
  let page: URL;
  try {
    page = new URL(info.pageUrl ?? '');
  } catch {
    return { unsupported: true, at };
  }
  if (!/^https?:$/.test(page.protocol) || /\.pdf$/i.test(page.pathname)) return { unsupported: true, at };
  return {
    text: (info.selectionText ?? '').replace(/\s+/g, ' ').trim(),
    url: page.origin + page.pathname,
    domain: page.hostname.replace(/^www\./, ''),
    title: tab?.title ?? '',
    at,
  };
}
