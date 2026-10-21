import { describe, expect, it } from 'vitest';
import { locateClaim, windows } from './segment.js';

const seg = (i: number) => ({ startMs: i * 1000, endMs: i * 1000 + 999, text: `s${i}` });

describe('windows', () => {
  it('covers every segment with overlap', () => {
    const segs = Array.from({ length: 25 }, (_, i) => seg(i));
    const w = windows(segs, 10, 2);
    expect(w.map((x) => [x[0]!.text, x.at(-1)!.text])).toEqual([
      ['s0', 's9'],
      ['s8', 's17'],
      ['s16', 's24'],
    ]);
  });
  it('returns a single window for short transcripts', () => {
    expect(windows([seg(0), seg(1)])).toHaveLength(1);
  });
});

describe('locateClaim', () => {
  it('spans cues and ignores whitespace differences', () => {
    const r = locateClaim(
      [seg(0), { startMs: 1000, endMs: 2000, text: 'el paro' }, { startMs: 2000, endMs: 3000, text: 'bajó' }],
      'el  paro bajó',
    );
    expect(r).toMatchObject({ startMs: 1000, endMs: 3000 });
  });
  it('returns null when not a literal substring', () => {
    expect(locateClaim([seg(0)], 'otra cosa')).toBeNull();
  });
});
