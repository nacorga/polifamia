import { assertAllowedUrl, type Fetcher } from './safe-fetch.js';

/**
 * Comprueba que el enlace de una fuente responde (PRD §9.1 paso 7). Solo se consultan hosts de la
 * whitelist: fuera de ella el enlace queda `unverified` (no se hace fetch a URLs arbitrarias, SSRF).
 */
export async function checkLink(
  url: string,
  allowedHosts: readonly string[],
  fetcher: Fetcher,
): Promise<'verified' | 'unverified' | 'link_failed'> {
  try {
    assertAllowedUrl(url, allowedHosts);
  } catch {
    return 'unverified';
  }
  try {
    let res = await fetcher(url, { method: 'HEAD' });
    // Algunos servidores no implementan HEAD.
    if (res.status === 405 || res.status === 501) res = await fetcher(url);
    return res.status < 400 ? 'verified' : 'link_failed';
  } catch {
    return 'link_failed';
  }
}
