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
import { selectionFromClick, selectionKey } from '../src/lib/selection';
import { E2E_PORT } from './global-setup';

// `chrome` existe dentro del service worker donde se evalúan los callbacks de `sw.evaluate`.
declare const chrome: typeof browser;

const EXTENSION = fileURLToPath(new URL('../.output/chrome-mv3-e2e', import.meta.url));
const WATCH_HTML = readFileSync(new URL('./fixtures/watch.html', import.meta.url));
const VIDEO = readFileSync(new URL('./fixtures/video.webm', import.meta.url));
const ARTICLE_HTML = readFileSync(new URL('./fixtures/article.html', import.meta.url));
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
    // Medio ficticio en un dominio reservado (.example): artículo DEMO, nunca una web real.
    await context.route('https://diario.example/**', (route) =>
      route.fulfill({ body: ARTICLE_HTML, contentType: 'text/html' }),
    );
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

test('panel lateral: se abre con el icono en cualquier pestaña sin ver su URL', async ({
  context,
  sw,
  youtube,
}) => {
  const other = await context.newPage();
  await other.goto(ARTICLE_URL);
  void youtube;
  const result = await sw.evaluate(async () => {
    const [yt] = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    // Sin permiso `tabs` la extensión no ve la URL de pestañas fuera de YouTube (FR-003).
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
  // 002: el panel está disponible en cualquier pestaña (FR-013), pero solo se abre al invocarlo.
  expect(result.other.enabled).not.toBe(false);
  expect(result.otherUrlVisible).toBe(false);
});

test('cerrar panel: el botón × cierra la página del panel', async ({ panel }) => {
  await expect(panel.getByRole('heading', { name: 'Análisis disponible' })).toBeVisible({
    timeout: 15_000,
  });
  const button = panel.getByRole('button', { name: 'Cerrar panel' });
  await expect(button).toBeVisible();
  // El clic cierra la página: se dispara desde la propia página y solo se espera el evento `close`
  // (locator.click() puede fallar con «Target page closed» si el cierre gana la carrera).
  const closed = panel.waitForEvent('close');
  await button.evaluate((b: HTMLButtonElement) => setTimeout(() => b.click(), 0));
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

// —— 002: selección en artículos ——

const ARTICLE_URL = 'https://diario.example/2026/10/articulo-demo?utm_source=x&sessionid=abc#p3';
const ARTICLE_TITLE = 'DEMO — Precios y familias (artículo de prueba)';
const FACT = 'La inflación interanual cerró 2023 en el 3,1 %.';
const OPINION = 'Esta política fiscal es injusta para las familias.';

/** Abre el artículo DEMO y devuelve el id de su pestaña (la más reciente: sin `tabs` no vemos su URL). */
async function openArticle(context: BrowserContext, sw: Worker) {
  const page = await context.newPage();
  await page.goto(ARTICLE_URL);
  const tabId = await sw.evaluate(async () => Math.max(...(await chrome.tabs.query({})).map((t) => t.id!)));
  return { page, tabId };
}

/** Lo que haría el clic en «Investigar esta afirmación» (Playwright no puede pulsar menús nativos). */
const select = (sw: Worker, tabId: number, selectionText: string, pageUrl = ARTICLE_URL) =>
  sw.evaluate(([k, v]) => chrome.storage.session.set({ [k]: v }), [
    selectionKey(tabId),
    selectionFromClick({ selectionText, pageUrl }, { title: ARTICLE_TITLE }),
  ] as const);

async function openPanel(context: BrowserContext, sw: Worker, tabId: number) {
  const extId = new URL(sw.url()).host;
  const [panel] = await Promise.all([
    context.waitForEvent('page'),
    sw.evaluate(
      (url) => chrome.windows.create({ url, type: 'popup', width: 400, height: 800 }),
      `chrome-extension://${extId}/sidepanel.html?tabId=${tabId}`,
    ),
  ]);
  await panel!.waitForLoadState();
  return panel!;
}

const isCreate = (r: { method(): string; url(): string }) =>
  r.method() === 'POST' && r.url() === `${API}/v1/investigations`;

test('selección en artículo: panel con origen local, solo se envía el texto, resultado sin minuto', async ({
  context,
  sw,
}) => {
  const { tabId } = await openArticle(context, sw);
  const panel = await openPanel(context, sw, tabId);
  const bodies: unknown[] = [];
  panel.on('request', (r) => {
    if (isCreate(r)) bodies.push(r.postDataJSON());
  });
  // Con el panel ya abierto: la selección llega por `storage.session.onChanged`.
  await select(sw, tabId, `  ${FACT}\n`);

  await expect(panel.getByRole('heading', { name: 'Investigar esta afirmación' })).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveValue(FACT);
  await expect(panel.getByText('diario.example', { exact: true })).toBeVisible();
  await expect(
    panel.getByText('https://diario.example/2026/10/articulo-demo', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByText(/no se envían: solo se muestran aquí/)).toBeVisible();
  const shown = await panel.locator('body').innerText();
  for (const leak of ['utm_source', 'sessionid', '#p3']) expect(shown).not.toContain(leak);
  expect(bodies).toHaveLength(0); // nada se envía antes de confirmar (US1.2)

  await panel.getByRole('button', { name: 'Investigar', exact: true }).click();
  const result = panel.getByRole('article', { name: 'Resultado de la investigación' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.getByText('resultado simulado para probar la experiencia')).toBeVisible();
  await expect(result.getByText(/Texto seleccionado por ti en diario\.example/)).toBeVisible();
  await expect(result.getByRole('button', { name: /Volver al minuto/ })).toHaveCount(0);
  await expect(result.getByRole('button', { name: 'Hay un problema con esta investigación' })).toBeVisible();

  // SC-006: el cuerpo lleva solo texto, origen y clave; ni medio, ni dirección, ni título.
  expect(bodies).toHaveLength(1);
  const body = bodies[0] as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(['idempotencyKey', 'manualClaim', 'origin']);
  expect(body).toMatchObject({ manualClaim: FACT, origin: 'web_selection' });
  const raw = JSON.stringify(body);
  for (const leak of ['diario', 'articulo-demo', 'Precios y familias']) expect(raw).not.toContain(leak);
  // Se envió: la selección se borra de la sesión.
  expect(await sw.evaluate((k) => chrome.storage.session.get(k), selectionKey(tabId))).toEqual({});
});

test('mismo motor: la frase del artículo reutiliza la investigación del vídeo (SC-004)', async ({
  context,
  sw,
  panel,
}) => {
  const claim = (await claimsOf('DEMOvideo01')).find((c) => c.literal === FACT)!;
  const created: { status: number; id: string }[] = [];
  const track = (p: Page) =>
    p.on('response', async (r) => {
      if (isCreate(r.request()))
        created.push({ status: r.status(), id: ((await r.json()) as { id: string }).id });
    });
  track(panel);
  await panel.getByRole('button', { name: `Investigar: ${claim.literal}` }).click();
  await expect(panel.getByRole('article', { name: 'Resultado de la investigación' })).toBeVisible({
    timeout: 15_000,
  });

  const { tabId } = await openArticle(context, sw);
  await select(sw, tabId, FACT.toUpperCase()); // misma afirmación con otra forma: mismo texto normalizado
  const articlePanel = await openPanel(context, sw, tabId);
  track(articlePanel);
  await articlePanel.getByRole('button', { name: 'Investigar', exact: true }).click();
  const result = articlePanel.getByRole('article', { name: 'Resultado de la investigación' });
  await expect(result).toBeVisible();
  await expect(result.getByText(/Texto seleccionado por ti en diario\.example/)).toBeVisible();
  await expect(result.getByRole('button', { name: /Volver al minuto/ })).toHaveCount(0);

  await expect.poll(() => created.length).toBe(2);
  expect(created[1]!.status).toBe(200); // reutilizada, sin nueva investigación
  expect(created[1]!.id).toBe(created[0]!.id);
});

test('revisar la selección: recortar, demasiado corto y opinión no verificable', async ({ context, sw }) => {
  const { tabId } = await openArticle(context, sw);
  await select(sw, tabId, `Según el artículo, ${FACT} Y además los salarios subieron mucho.`);
  const panel = await openPanel(context, sw, tabId);
  const box = panel.getByRole('textbox');
  const submit = panel.getByRole('button', { name: 'Investigar', exact: true });
  await expect(box).toHaveValue(/Según el artículo/);

  await box.fill('corto');
  await expect(panel.getByText(/· mínimo 10/)).toBeVisible();
  await expect(submit).toBeDisabled();

  await box.fill(OPINION); // recortada a una sola frase: una opinión del catálogo DEMO
  await submit.click();
  await expect(panel.getByRole('heading', { name: 'No es una afirmación verificable' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await expect(panel.getByRole('article', { name: 'Resultado de la investigación' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '← Volver' })).toBeVisible();
});

test('panel en cualquier página: guía, pegar y página no compatible', async ({ context, sw }) => {
  const { tabId } = await openArticle(context, sw);
  const panel = await openPanel(context, sw, tabId);
  await expect(
    panel.getByRole('heading', { name: 'Selecciona una frase y elige «Investigar esta afirmación»' }),
  ).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Pegar una afirmación' })).toBeVisible();

  await select(sw, tabId, FACT, 'https://diario.example/informe.pdf'); // visor de PDF (FR-014)
  await expect(panel.getByRole('heading', { name: 'Esta página no es compatible' })).toBeVisible();
  await panel.getByRole('button', { name: 'Pegar una afirmación' }).click();
  await expect(panel.getByRole('heading', { name: 'Pegar una afirmación' })).toBeVisible();
});

test('sin invocar la extensión: nada leído ni enviado (SC-002)', async ({ context, sw }) => {
  const calls: string[] = [];
  context.on('request', (r) => {
    if (r.url().startsWith(API)) calls.push(r.url());
  });
  const { page } = await openArticle(context, sw);
  await page.getByText(FACT).selectText();
  await page.goto('https://diario.example/otra-noticia');
  await page.waitForTimeout(1000);
  expect(calls).toEqual([]);
  expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
});
