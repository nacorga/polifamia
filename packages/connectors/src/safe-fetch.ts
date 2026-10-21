/** Error de acceso a una fuente: el investigador lo traduce a `source_unavailable`, nunca a una conclusión. */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
  }
}

export interface SafeFetchOptions {
  allowedHosts: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
}

export interface SafeResponse {
  url: string;
  status: number;
  text: string;
}

export type Fetcher = (url: string, opts?: Partial<SafeFetchOptions>) => Promise<SafeResponse>;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Lanza si la URL no es https, apunta a una IP literal o a un host fuera de la whitelist (SSRF). */
export function assertAllowedUrl(raw: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceError('invalid URL', raw);
  }
  if (url.protocol !== 'https:') throw new SourceError(`scheme not allowed: ${url.protocol}`, raw);
  if (url.username || url.password) throw new SourceError('credentials in URL not allowed', raw);
  const host = url.hostname.toLowerCase();
  if (IPV4.test(host) || host.includes(':') || host.startsWith('['))
    throw new SourceError('IP literal not allowed', raw);
  if (url.port && url.port !== '443') throw new SourceError('port not allowed', raw);
  if (!allowedHosts.includes(host)) throw new SourceError(`host not allowed: ${host}`, raw);
  return url;
}

/**
 * fetch acotado para fuentes externas: whitelist exacta de hosts, solo https, redirecciones revalidadas
 * salto a salto, timeout y tamaño máximo de respuesta.
 * ponytail: no fija la IP resuelta (DNS rebinding); aceptable con hosts institucionales en whitelist.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const { allowedHosts, timeoutMs = 10_000, maxBytes = 2_000_000, maxRedirects = 3 } = opts;
  let url = assertAllowedUrl(raw, allowedHosts);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        redirect: 'manual',
        signal,
        headers: { 'user-agent': 'polifamia/0.1 (+investigación de afirmaciones)', ...opts.headers },
      });
    } catch (err) {
      throw new SourceError(`fetch failed: ${(err as Error).message}`, url.href);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location || hop >= maxRedirects) throw new SourceError('too many or bad redirects', url.href);
      url = assertAllowedUrl(new URL(location, url).href, allowedHosts);
      continue;
    }
    return { url: url.href, status: res.status, text: await readCapped(res, maxBytes, url.href) };
  }
}

async function readCapped(res: Response, maxBytes: number, url: string): Promise<string> {
  if (!res.body) return '';
  const declared = Number(res.headers.get('content-length'));
  if (declared > maxBytes) throw new SourceError(`response too large (${declared} bytes)`, url);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new SourceError(`response too large (>${maxBytes} bytes)`, url);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Fetcher con whitelist fija; los conectores reciben uno para poder sustituirlo en tests. */
export const createFetcher =
  (allowedHosts: readonly string[], defaults: Partial<SafeFetchOptions> = {}): Fetcher =>
  (url, opts) =>
    safeFetch(url, { ...defaults, ...opts, allowedHosts });
