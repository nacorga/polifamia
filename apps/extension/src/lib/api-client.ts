import { browser } from '#imports';
import {
  Availability,
  ClaimsResponse,
  ErrorResponse,
  FeedbackCreated,
  Investigation,
  type CreateEvent,
  type CreateFeedback,
  type CreateInvestigation,
  type ErrorCode,
} from '@polifamia/contracts';
import type { z } from 'zod';

export const API_URL = import.meta.env.WXT_API_URL ?? 'http://localhost:3100';
export const API_HOST = new URL(API_URL).host;

export class ApiRequestError extends Error {
  constructor(
    readonly code: ErrorCode | 'network',
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let installId: Promise<string> | undefined;
/** Identificador anónimo de instalación: sirve para cuotas, no es autenticación. */
function getInstallId(): Promise<string> {
  installId ??= browser.storage.local.get('installId').then(async ({ installId: stored }) => {
    if (typeof stored === 'string') return stored;
    const id = crypto.randomUUID();
    await browser.storage.local.set({ installId: id });
    return id;
  });
  return installId;
}

async function request<S extends z.ZodType>(
  schema: S | null,
  path: string,
  init?: { method: string; body: unknown },
) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? 'GET',
      headers: { 'content-type': 'application/json', 'x-install-id': await getInstallId() },
      body: init ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiRequestError('network', 0, 'No se puede conectar con el servidor');
  }
  if (!res.ok) {
    const err = ErrorResponse.safeParse(await res.json().catch(() => null));
    const code = err.success ? err.data.error.code : res.status === 429 ? 'rate_limited' : 'internal';
    throw new ApiRequestError(code, res.status, err.success ? err.data.error.message : res.statusText);
  }
  return { status: res.status, data: (schema ? schema.parse(await res.json()) : null) as z.infer<S> };
}

export const api = {
  availability: async (videoId: string) =>
    (await request(Availability, `/v1/videos/${videoId}/availability`)).data,
  claims: async (videoId: string) => (await request(ClaimsResponse, `/v1/videos/${videoId}/claims`)).data,
  investigation: async (id: string) => (await request(Investigation, `/v1/investigations/${id}`)).data,
  createInvestigation: async (body: CreateInvestigation) =>
    (await request(Investigation, '/v1/investigations', { method: 'POST', body })).data,
  feedback: async (id: string, body: CreateFeedback) =>
    (await request(FeedbackCreated, `/v1/investigations/${id}/feedback`, { method: 'POST', body })).data,
  /** Eventos mínimos de producto (FR-017); un fallo nunca afecta a la experiencia. */
  event: (body: CreateEvent) =>
    void request(null, '/v1/events', { method: 'POST', body }).catch(() => undefined),
};
