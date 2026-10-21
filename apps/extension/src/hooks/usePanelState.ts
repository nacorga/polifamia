import {
  TERMINAL_JOB_STATUSES,
  type Availability,
  type Investigation,
  type UxState,
} from '@polifamia/contracts';
import { ApiRequestError } from '../lib/api-client';

type Query<T> = { data?: T; error?: unknown };

export type PanelState = UxState | 'loading';

function errorState(error: unknown): UxState {
  if (!(error instanceof ApiRequestError)) return 'error';
  if (error.code === 'rate_limited') return 'rate_limited';
  if (error.code === 'source_unavailable') return 'source_unavailable';
  if (error.code === 'unsupported_video') return 'unsupported_video';
  return 'error';
}

export function investigationState({ data, error }: Query<Investigation>): PanelState {
  if (error) return errorState(error);
  if (!data || data.status === 'PENDING' || data.status === 'RUNNING') return 'investigation_pending';
  if (data.status === 'INSUFFICIENT_EVIDENCE' || data.conclusion === 'INSUFFICIENT_EVIDENCE')
    return 'insufficient_evidence';
  if (data.status === 'COMPLETED') return 'investigation_ready';
  if (data.failureReason === 'source_unavailable') return 'source_unavailable';
  if (data.failureReason === 'budget_exceeded') return 'rate_limited';
  return 'error';
}

/** Estado UX del vídeo activo (FR-009), derivado de las consultas sin estado propio. */
export function videoState(
  videoId: string | null,
  availability: Query<Availability>,
  claims: Query<unknown>,
): PanelState {
  if (!videoId) return 'idle';
  if (availability.error) return errorState(availability.error);
  if (!availability.data) return 'loading';
  if (availability.data.status !== 'claims_ready') return availability.data.status;
  if (claims.error) return errorState(claims.error);
  return claims.data ? 'claims_ready' : 'loading';
}

const BACKOFF_MS = [1000, 2000, 4000];
/** Polling acotado: 1 s → 2 s → 4 s; se detiene en estados terminales. */
export function pollInterval(data: Investigation | undefined, fetches: number): number | false {
  if (data && TERMINAL_JOB_STATUSES.includes(data.status)) return false;
  return BACKOFF_MS[Math.min(Math.max(fetches - 1, 0), BACKOFF_MS.length - 1)]!;
}
