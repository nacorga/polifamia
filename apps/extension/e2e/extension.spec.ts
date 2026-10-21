import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { browser } from 'wxt/browser';
import { E2E_PORT } from './global-setup';

// `chrome` existe dentro del service worker donde se evalúan los callbacks de `sw.evaluate`.
declare const chrome: typeof browser;

const EXTENSION = fileURLToPath(new URL('../.output/chrome-mv3-e2e', import.meta.url));
const WATCH_HTML = readFileSync(new URL('./fixtures/watch.html', import.meta.url));
const VIDEO = readFileSync(new URL('./fixtures/video.webm', import.meta.url));
const API = `http://localhost:${E2E_PORT}`;

type ClaimDto = { id: string; literal: string; startMs: number; checkability: string };
const claimsOf = async (videoId: string): Promise<ClaimDto[]> =>
  ((await (await fetch(`${API}/v1/videos/${videoId}/claims`)).json()) as { claims: ClaimDto[] }).claims;

type Fixtures = { context: BrowserContext; sw: Worker; youtube: Page; panel: Page };

/** YouTube servido desde un fixture local (sin depender de vídeos públicos) y panel vinculado a esa pestaña. */
const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION}`,
        `--load-extension=${EXTENSION}`,
        '--autoplay-policy=no-user-gesture-required',
      ],
    });
    await context.route('https://www.youtube.com/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/__fixture/video.webm')
        return route.fulfill({ body: VIDEO, contentType: 'video/webm' });
      return route.fulfill({ body: WATCH_HTML, contentType: 'text/html' });
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  youtube: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto('https://www.youtube.com/watch?v=DEMOvideo01');
    await page.waitForFunction(() => (document.querySelector('video')?.duration ?? 0) > 0);
    await use(page);
  },
  panel: async ({ context, sw, youtube }, use) => {
    const tabId = await sw.evaluate(
      async () => (await chrome.tabs.query({ url: 'https://www.youtube.com/*' }))[0]!.id!,
    );
    const extId = new URL(sw.url()).host;
    // Ventana propia: la pestaña de YouTube sigue visible y activa, como con el panel lateral real.
    const [panel] = await Promise.all([
      context.waitForEvent('page'),
      sw.evaluate(
        (url) => chrome.windows.create({ url, type: 'popup', width: 400, height: 800 }),
        `chrome-extension://${extId}/sidepanel.html?tabId=${tabId}`,
      ),
    ]);
    await panel!.waitForLoadState();
    void youtube;
    await use(panel!);
  },
});

const navigateSpa = (page: Page, videoId: string) =>
  page.evaluate((id) => {
    history.pushState({}, '', `/watch?v=${id}`);
    document.dispatchEvent(new Event('yt-navigate-finish'));
  }, videoId);

test('vídeo del catálogo: lista DEMO, salto al minuto ≤2 s sin pausar', async ({ panel, youtube }) => {
  const claims = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible();
  await expect(panel.getByText('DEMO').first()).toBeVisible();
  const list = panel.getByRole('list', { name: 'Afirmaciones verificables' });
  await expect(list.getByRole('listitem')).toHaveCount(claims.length);

  const target = claims[claims.length - 1]!;
  const pausedBefore = await youtube.evaluate(() => document.querySelector('video')!.paused);
  await list
    .getByRole('listitem')
    .filter({ hasText: target.literal })
    .getByRole('button', { name: /Ir al minuto/ })
    .click();
  await expect
    .poll(() => youtube.evaluate(() => document.querySelector('video')!.currentTime))
    .toBeGreaterThanOrEqual(target.startMs / 1000);
  const t = await youtube.evaluate(() => document.querySelector('video')!.currentTime);
  expect(Math.abs(t - target.startMs / 1000)).toBeLessThanOrEqual(2);
  expect(await youtube.evaluate(() => document.querySelector('video')!.paused)).toBe(pausedBefore);
});

test('navegación SPA: el panel cambia de vídeo sin mezclar afirmaciones', async ({ panel, youtube }) => {
  const [one, two] = [await claimsOf('DEMOvideo01'), await claimsOf('DEMOvideo02')];
  await expect(panel.getByText(one[0]!.literal)).toBeVisible();
  await navigateSpa(youtube, 'DEMOvideo02');
  await expect(panel.getByText(two[0]!.literal)).toBeVisible();
  for (const c of one) await expect(panel.getByText(c.literal)).toHaveCount(0);
});

test('investigar: progreso, resultado DEMO en orden y reporte de problema', async ({ panel }) => {
  const [claim] = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
  await panel.getByRole('button', { name: `Investigar: ${claim!.literal}` }).click();
  await expect(panel.getByRole('heading', { name: 'Investigando…' })).toBeVisible();
  const result = panel.getByRole('article', { name: 'Resultado de la investigación' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.getByText('resultado simulado para probar la experiencia')).toBeVisible();

  const text = await result.innerText();
  const order = ['Afirmación', 'Qué muestran las evidencias', 'Contexto y limitaciones', 'Fuentes'].map((h) =>
    text.indexOf(h),
  );
  expect(order.every((i) => i >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(result.getByText(/Comprobado el/)).toBeVisible();
  await expect(result.getByRole('button', { name: /Volver al minuto/ })).toBeVisible();

  await result.getByRole('button', { name: 'Hay un problema con esta investigación' }).click();
  await panel.getByLabel('La fuente no respalda lo que se le atribuye').check();
  await panel.getByRole('button', { name: 'Enviar reporte' }).click();
  await expect(panel.getByRole('heading', { name: 'Gracias por el reporte' })).toBeVisible();
  await panel.getByRole('button', { name: 'Volver al resultado' }).click();
  await expect(result).toBeVisible();
});

test('resultado tardío no aparece tras cambiar de vídeo', async ({ panel, youtube }) => {
  const [, claim] = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
  const two = await claimsOf('DEMOvideo02');
  await panel.getByRole('button', { name: `Investigar: ${claim!.literal}` }).click();
  await navigateSpa(youtube, 'DEMOvideo02');
  await expect(panel.getByText(two[0]!.literal)).toBeVisible();
  await panel.waitForTimeout(3000); // más que DEMO_DELAY_MS: el job termina mientras tanto
  await expect(panel.getByRole('article', { name: 'Resultado de la investigación' })).toHaveCount(0);
  await expect(panel.getByText(two[0]!.literal)).toBeVisible();
});

test('vídeo no compatible: pegar afirmación sin minuto', async ({ panel, youtube }) => {
  await navigateSpa(youtube, 'dQw4w9WgXcQ');
  await expect(panel.getByRole('heading', { name: 'Vídeo todavía no compatible' })).toBeVisible();
  await panel.getByRole('button', { name: 'Pegar una afirmación' }).click();
  const submit = panel.getByRole('button', { name: 'Investigar', exact: true });
  await panel.getByRole('textbox').fill('corto');
  await expect(submit).toBeDisabled();
  await panel.getByRole('textbox').fill('El paro registrado bajó un 5 % en el último año en España.');
  await expect(panel.getByText(`localhost:${E2E_PORT}`).first()).toBeVisible();
  await submit.click();
  const result = panel.getByRole('article', { name: 'Resultado de la investigación' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.getByText(/Texto aportado por ti/)).toBeVisible();
  await expect(result.getByRole('button', { name: /Volver al minuto/ })).toHaveCount(0);
});

test('API caída: error recuperable con reintento', async ({ panel }) => {
  await panel.route(`${API}/**`, (route) => route.abort('connectionrefused'));
  await panel.reload();
  await expect(panel.getByRole('heading', { name: 'No se ha podido completar' })).toBeVisible({
    timeout: 15_000,
  });
  await panel.unroute(`${API}/**`);
  await panel.getByRole('button', { name: 'Reintentar' }).click();
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible();
});

test('panel lateral: se abre con el icono y solo está habilitado en YouTube', async ({
  context,
  sw,
  youtube,
}) => {
  await context.route('https://example.org/**', (route) =>
    route.fulfill({ body: 'otra web', contentType: 'text/html' }),
  );
  const other = await context.newPage();
  await other.goto('https://example.org/');
  void youtube;
  const result = await sw.evaluate(async () => {
    const [yt] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    // Sin permiso `tabs` la extensión no ve la URL de pestañas fuera de YouTube (FR-012).
    const ex = (await chrome.tabs.query({})).find(
      (t) => t.id !== yt!.id && !t.url && t.status === 'complete',
    );
    return {
      behavior: await chrome.sidePanel.getPanelBehavior(),
      youtube: await chrome.sidePanel.getOptions({ tabId: yt!.id! }),
      other: await chrome.sidePanel.getOptions({ tabId: ex!.id! }),
      otherUrlVisible: ex!.url !== undefined,
    };
  });
  expect(result.behavior.openPanelOnActionClick).toBe(true);
  expect(result.youtube.enabled).toBe(true);
  expect(result.other.enabled).toBe(false);
  expect(result.otherUrlVisible).toBe(false);
});

test('cerrar panel: el botón × cierra la página del panel', async ({ panel }) => {
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible({
    timeout: 15_000,
  });
  const closed = panel.waitForEvent('close');
  await panel.getByRole('button', { name: 'Cerrar panel' }).click();
  await closed;
});

/** Investigación terminada en FAILED con un motivo operativo (respuesta simulada de la API). */
const failedInvestigation = (failureReason: string) => ({
  id: '11111111-1111-4111-8111-111111111111',
  version: 1,
  status: 'FAILED',
  conclusion: null,
  isDemo: false,
  claim: { kind: 'manual', text: 'El paro bajó un 5 % en 2024 en España.' },
  summary: null,
  context: null,
  limitations: null,
  stats: null,
  evidence: [],
  failureReason,
  checkedAt: null,
  expiresAt: null,
  createdAt: new Date().toISOString(),
});

for (const [reason, title] of [
  ['provider_error', 'El servicio de análisis ha fallado'],
  ['no_llm_key', 'Investigación automática no disponible'],
  ['timeout', 'La investigación ha tardado demasiado'],
  ['budget_exceeded', 'Límite diario de investigaciones alcanzado'],
  ['source_unavailable', 'Una fuente no está disponible ahora mismo'],
] as const) {
  test(`fallo operativo ${reason}: estado propio, sin conclusión`, async ({ panel }) => {
    await panel.route(`${API}/v1/investigations**`, (route) =>
      route.fulfill({ json: failedInvestigation(reason), status: 200 }),
    );
    const [claim] = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
    await panel.getByRole('button', { name: `Investigar: ${claim!.literal}` }).click();
    await expect(panel.getByRole('heading', { name: title })).toBeVisible();
    await expect(panel.getByRole('article', { name: 'Resultado de la investigación' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  });
}

test('límites de la API: rate limit y presupuesto diario al crear', async ({ panel }) => {
  const [claim] = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
  for (const [code, title] of [
    ['rate_limited', 'Límite de uso alcanzado'],
    ['budget_exceeded', 'Límite diario de investigaciones alcanzado'],
  ]) {
    await panel.route(`${API}/v1/investigations`, (route) =>
      route.fulfill({ status: 429, json: { error: { code, message: 'limit' } } }),
    );
    await panel.getByRole('button', { name: `Investigar: ${claim!.literal}` }).click();
    await expect(panel.getByRole('heading', { name: title })).toBeVisible();
    await panel.getByRole('button', { name: '← Volver' }).click();
    await panel.unroute(`${API}/v1/investigations`);
  }
});

test('doble clic en Investigar: una sola investigación', async ({ panel }) => {
  const claims = (await claimsOf('DEMOvideo01')).filter((c) => c.checkability === 'CHECKABLE');
  const claim = claims[claims.length - 1]!;
  const ids: string[] = [];
  panel.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().endsWith('/v1/investigations'))
      ids.push(((await r.json()) as { id: string }).id);
  });
  await panel.getByRole('button', { name: `Investigar: ${claim.literal}` }).dblclick();
  await expect(panel.getByRole('article', { name: 'Resultado de la investigación' })).toBeVisible({
    timeout: 15_000,
  });
  expect(ids.length).toBeGreaterThanOrEqual(1);
  expect(new Set(ids).size).toBe(1);
});

test('varias pestañas: cada panel sigue su pestaña sin mezclar vídeos', async ({ context, panel }) => {
  const [one, two] = [await claimsOf('DEMOvideo01'), await claimsOf('DEMOvideo02')];
  const other = await context.newPage();
  await other.goto('https://www.youtube.com/watch?v=DEMOvideo02');
  await other.bringToFront();
  await navigateSpa(other, 'dQw4w9WgXcQ');
  // El panel vinculado a la primera pestaña no cambia por lo que ocurra en la segunda.
  await expect(panel.getByText(one[0]!.literal)).toBeVisible();
  for (const c of two) await expect(panel.getByText(c.literal)).toHaveCount(0);
  await expect(panel.getByRole('heading', { name: 'Vídeo todavía no compatible' })).toHaveCount(0);
});

test('cobertura y límites: se consulta sin perder la vista actual', async ({ panel }) => {
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible();
  await panel.getByRole('button', { name: 'Cobertura y límites' }).click();
  const coverage = panel.getByRole('region', { name: 'Cobertura y límites' });
  await expect(coverage.getByText(/no significa que la afirmación sea falsa/)).toBeVisible();
  await coverage.getByRole('button', { name: '← Volver' }).click();
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible();
});
