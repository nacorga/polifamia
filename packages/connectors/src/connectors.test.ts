import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCorpus, searchCorpus } from './corpus.js';
import { parseFactCheckResponse, redactKey, searchFactChecks } from './factcheck.js';
import { fetchIneSeries, ineQueryUrl, parseIneResponse, periodRange } from './ine/client.js';
import { findSeries, INE_SERIES, territoryMatches } from './ine/registry.js';
import { assertAllowedUrl, safeFetch, SourceError, type Fetcher } from './safe-fetch.js';

const fixture = (p: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${p}`, import.meta.url)), 'utf8'));
const series = (code: string) => INE_SERIES.find((s) => s.code === code)!;
const HOSTS = ['servicios.ine.es'];

describe('safe-fetch (SSRF)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['http://servicios.ine.es/x', /scheme/],
    ['file:///etc/passwd', /scheme/],
    ['https://127.0.0.1/', /IP literal/],
    ['https://[::1]/', /IP literal/],
    ['https://169.254.169.254/latest/meta-data', /IP literal/],
    ['https://evil.example/', /host not allowed/],
    ['https://servicios.ine.es.evil.example/', /host not allowed/],
    ['https://user:pw@servicios.ine.es/', /credentials/],
    ['https://servicios.ine.es:8443/', /port/],
    ['not a url', /invalid URL/],
  ])('rejects %s', (url, msg) => {
    expect(() => assertAllowedUrl(url, HOSTS)).toThrow(msg);
  });

  it('revalidates every redirect hop', async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/' } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(safeFetch('https://servicios.ine.es/a', { allowedHosts: HOSTS })).rejects.toThrow(
      /IP literal/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('follows allowed redirects and caps redirect count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 301, headers: { location: '/loop' } })),
    );
    await expect(safeFetch('https://servicios.ine.es/a', { allowedHosts: HOSTS })).rejects.toThrow(
      /redirects/,
    );
  });

  it('enforces max response size', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x'.repeat(5000))),
    );
    await expect(
      safeFetch('https://servicios.ine.es/a', { allowedHosts: HOSTS, maxBytes: 1000 }),
    ).rejects.toThrow(/too large/);
  });

  it('maps network errors to SourceError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('ECONNREFUSED');
      }),
    );
    await expect(safeFetch('https://servicios.ine.es/a', { allowedHosts: HOSTS })).rejects.toBeInstanceOf(
      SourceError,
    );
  });
});

describe('INE Tempus3', () => {
  it('builds reproducible period queries', () => {
    expect(periodRange('2024T3')).toBe('20240701:20240930');
    expect(periodRange('2023-12')).toBe('20231201:20231231');
    expect(periodRange('2024-02')).toBe('20240201:20240229');
    expect(periodRange('2023')).toBe('20230101:20231231');
    expect(periodRange('tercer trimestre')).toBeNull();
    expect(ineQueryUrl(series('EPA452434'), '2024T3')).toBe(
      'https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/EPA452434?date=20240701:20240930',
    );
  });

  it('parses recorded real responses (quarterly and monthly)', () => {
    const epa = fixture('ine/EPA452434.2024T3.json');
    const r = parseIneResponse(series('EPA452434'), epa._recorded.url, epa.body);
    expect(r.observations).toEqual([{ period: '2024T3', value: 11.21 }]);
    const ipc = fixture('ine/IPC251856.2023-12.json');
    expect(parseIneResponse(series('IPC251856'), ipc._recorded.url, ipc.body).observations).toEqual([
      { period: '2023-12', value: 3.1 },
    ]);
  });

  it('rejects a response for another series or with an unexpected shape', () => {
    const epa = fixture('ine/EPA452434.2024T3.json');
    expect(() => parseIneResponse(series('IPC251856'), 'u', epa.body)).toThrow(/returned EPA452434/);
    expect(() => parseIneResponse(series('IPC251856'), 'u', '<html>')).toThrow(/shape/);
  });

  it('fetches via the injected fetcher and surfaces HTTP errors', async () => {
    const epa = fixture('ine/EPA452434.2024T3.json');
    const ok: Fetcher = async (url) => ({ url, status: 200, text: epa.body });
    expect((await fetchIneSeries(ok, series('EPA452434'), '2024T3')).queryUrl).toBe(epa._recorded.url);
    const down: Fetcher = async (url) => ({ url, status: 503, text: '' });
    await expect(fetchIneSeries(down, series('EPA452434'))).rejects.toThrow(/503/);
  });

  it('matches only approved metrics and national territory', () => {
    expect(findSeries('tasa de paro')?.code).toBe('EPA452434');
    expect(findSeries('IPC variación interanual')?.code).toBe('IPC251856');
    expect(findSeries('afiliación a la Seguridad Social')).toBeNull();
    expect(findSeries(undefined)).toBeNull();
    expect(territoryMatches('España')).toBe(true);
    expect(territoryMatches('Andalucía')).toBe(false);
    expect(territoryMatches(undefined)).toBeNull();
  });
});

describe('Fact Check Tools (synthetic-shape fixture)', () => {
  const f = fixture('factcheck.synthetic-shape.json');

  it('parses documented shape and drops non-https reviews', () => {
    const reviews = parseFactCheckResponse(JSON.stringify(f.body), 'https://x/?key=SECRET');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ publisher: '[SINTÉTICO] Verificador A', textualRating: 'Verdadero' });
  });

  it('never leaks the API key in errors', async () => {
    const bad: Fetcher = async (url) => ({ url, status: 403, text: '' });
    const err = await searchFactChecks(bad, 'paro', 'SECRET').catch((e: SourceError) => e);
    expect((err as SourceError).url).not.toContain('SECRET');
    expect(redactKey('https://h/p?query=a&key=SECRET&x=1')).toBe('https://h/p?query=a&key=REDACTED&x=1');
  });
});

describe('corpus', () => {
  it('loads authorized documents and finds the literal passage', async () => {
    const docs = await loadCorpus(fileURLToPath(new URL('../../../corpus/documents', import.meta.url)));
    expect(docs.length).toBeGreaterThan(0);
    const hits = searchCorpus(docs, 'El salario mínimo interprofesional se sitúa en 1.134 euros al mes');
    expect(hits[0]?.locator).toBe('BOE-A-2024-2251, artículo 1');
    expect(hits[0]?.text).toContain('1.134 euros/mes');
    expect(searchCorpus(docs, 'la afiliación a la Seguridad Social superó los 21 millones')).toEqual([]);
  });
});
