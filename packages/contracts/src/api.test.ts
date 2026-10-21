import { describe, expect, it } from 'vitest';
import { CreateInvestigation, CreateEvent, ExtensionMessage, Investigation, YoutubeId } from './index.js';

describe('contracts', () => {
  it('validates YouTube ids', () => {
    expect(YoutubeId.safeParse('dQw4w9WgXcQ').success).toBe(true);
    expect(YoutubeId.safeParse('short').success).toBe(false);
    expect(YoutubeId.safeParse('dQw4w9WgXc!').success).toBe(false);
  });

  it('accepts exactly one of claimId / manualClaim', () => {
    const claimId = '0b6f6f9e-7a0e-4f4c-9d0e-2b8f3c1d5a6e';
    expect(CreateInvestigation.safeParse({ claimId, idempotencyKey: 'abcdefgh' }).success).toBe(true);
    expect(
      CreateInvestigation.safeParse({
        manualClaim: 'El paro bajó un 5 % en 2024',
        idempotencyKey: 'abcdefgh',
      }).success,
    ).toBe(true);
    expect(
      CreateInvestigation.safeParse({
        claimId,
        manualClaim: 'El paro bajó un 5 %',
        idempotencyKey: 'abcdefgh',
      }).success,
    ).toBe(false);
    expect(CreateInvestigation.safeParse({ idempotencyKey: 'abcdefgh' }).success).toBe(false);
  });

  it('bounds manual claim length after trimming', () => {
    const p = (manualClaim: string) =>
      CreateInvestigation.safeParse({ manualClaim, idempotencyKey: 'abcdefgh' });
    expect(p('   corto   ').success).toBe(false);
    expect(p('x'.repeat(501)).success).toBe(false);
  });

  it('accepts a web selection origin but never page data', () => {
    const p = (extra: object) =>
      CreateInvestigation.safeParse({
        manualClaim: 'El paro bajó un 5 % en 2024',
        idempotencyKey: 'abcdefgh',
        ...extra,
      }).success;
    expect(p({ origin: 'web_selection' })).toBe(true);
    expect(p({ origin: 'other' })).toBe(false);
    expect(p({ origin: 'web_selection', url: 'https://diario.example/a' })).toBe(false);
    expect(p({ origin: 'web_selection', title: 'Titular' })).toBe(false);
  });

  it('rejects unknown event names and extra fields', () => {
    expect(CreateEvent.safeParse({ name: 'panel_opened' }).success).toBe(true);
    expect(CreateEvent.safeParse({ name: 'selection_investigated' }).success).toBe(true);
    expect(CreateEvent.safeParse({ name: 'page_viewed' }).success).toBe(false);
    expect(CreateEvent.safeParse({ name: 'panel_opened', url: 'https://x' }).success).toBe(false);
  });

  it('parses a manual investigation without timestamp', () => {
    const r = Investigation.safeParse({
      id: '0b6f6f9e-7a0e-4f4c-9d0e-2b8f3c1d5a6e',
      version: 1,
      status: 'PENDING',
      conclusion: null,
      isDemo: true,
      claim: { kind: 'manual', text: 'El paro bajó' },
      summary: null,
      context: null,
      limitations: null,
      stats: null,
      evidence: [],
      failureReason: null,
      checkedAt: null,
      expiresAt: null,
      createdAt: '2026-10-21T10:00:00.000Z',
    });
    expect(r.success).toBe(true);
  });

  it('discriminates extension messages', () => {
    expect(
      ExtensionMessage.safeParse({ type: 'video:seek', requestId: 'r1', videoId: 'dQw4w9WgXcQ', seconds: 12 })
        .success,
    ).toBe(true);
    expect(ExtensionMessage.safeParse({ type: 'video:seek', requestId: 'r1', seconds: 12 }).success).toBe(
      false,
    );
  });
});
