import type { Investigation } from '@polifamia/contracts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('#imports', () => ({ browser: {} }));
const { ApiRequestError } = await import('../lib/api-client');
const { investigationState, pollInterval, videoState } = await import('./usePanelState');

const inv = (over: Partial<Investigation>): Investigation => ({
  id: '00000000-0000-4000-8000-000000000000',
  version: 1,
  status: 'COMPLETED',
  conclusion: 'NEEDS_CONTEXT',
  isDemo: true,
  claim: { kind: 'manual', text: 'x' },
  summary: null,
  context: null,
  limitations: null,
  stats: null,
  evidence: [],
  failureReason: null,
  checkedAt: null,
  expiresAt: null,
  createdAt: '2026-10-21T00:00:00Z',
  ...over,
});
const ready = { videoId: 'DEMOvideo01', status: 'claims_ready', isDemo: true } as const;

describe('videoState', () => {
  it('sin vídeo → idle', () => expect(videoState(null, {}, {})).toBe('idle'));
  it('cargando → loading', () => expect(videoState('DEMOvideo01', {}, {})).toBe('loading'));
  it('estados de catálogo', () => {
    for (const status of ['unsupported_video', 'transcript_unavailable', 'preparing_claims'] as const)
      expect(videoState('DEMOvideo01', { data: { ...ready, status } }, {})).toBe(status);
  });
  it('claims listas', () => {
    expect(videoState('DEMOvideo01', { data: ready }, {})).toBe('loading');
    expect(videoState('DEMOvideo01', { data: ready }, { data: [] })).toBe('claims_ready');
  });
  it('errores de API', () => {
    const e = (code: 'network' | 'rate_limited' | 'unsupported_video' | 'internal') => ({
      error: new ApiRequestError(code, 0, ''),
    });
    expect(videoState('DEMOvideo01', e('network'), {})).toBe('error');
    expect(videoState('DEMOvideo01', e('rate_limited'), {})).toBe('rate_limited');
    expect(videoState('DEMOvideo01', { data: ready }, e('unsupported_video'))).toBe('unsupported_video');
    expect(videoState('DEMOvideo01', { error: new Error('x') }, {})).toBe('error');
  });
});

describe('investigationState', () => {
  it('pendiente', () => {
    expect(investigationState({})).toBe('investigation_pending');
    expect(investigationState({ data: inv({ status: 'RUNNING', conclusion: null }) })).toBe(
      'investigation_pending',
    );
  });
  it('resultado y abstención', () => {
    expect(investigationState({ data: inv({}) })).toBe('investigation_ready');
    expect(investigationState({ data: inv({ conclusion: 'INSUFFICIENT_EVIDENCE' }) })).toBe(
      'insufficient_evidence',
    );
    expect(investigationState({ data: inv({ status: 'INSUFFICIENT_EVIDENCE', conclusion: null }) })).toBe(
      'insufficient_evidence',
    );
  });
  it('fallos operativos no son resultados', () => {
    const failed = (failureReason: Investigation['failureReason']) =>
      investigationState({ data: inv({ status: 'FAILED', conclusion: null, failureReason }) });
    expect(failed('source_unavailable')).toBe('source_unavailable');
    expect(failed('budget_exceeded')).toBe('rate_limited');
    expect(failed('timeout')).toBe('error');
  });
});

describe('pollInterval', () => {
  it('backoff y parada en terminal', () => {
    const running = inv({ status: 'RUNNING' });
    expect([1, 2, 3, 9].map((n) => pollInterval(running, n))).toEqual([1000, 2000, 4000, 4000]);
    expect(pollInterval(inv({ status: 'FAILED' }), 2)).toBe(false);
    expect(pollInterval(inv({}), 1)).toBe(false);
  });
});
