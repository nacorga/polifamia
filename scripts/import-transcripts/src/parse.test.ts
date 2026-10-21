import { describe, expect, it } from 'vitest';
import { locateClaim, parseSubtitles } from './parse.js';

const SRT = `\uFEFF1\r
00:00:01,000 --> 00:00:04,500\r
El paro bajó\r
un 5 % en 2024.\r
\r
2\r
00:00:05,000 --> 00:00:08,000\r
Es una gran noticia.\r
`;

const VTT = `WEBVTT - demo

NOTE esto es un comentario

STYLE
::cue { color: red }

intro
00:01.000 --> 00:04.500 align:start position:10%
<v Orador>El paro <b>bajó</b></v>
un 5 % en 2024.

01:00:05.250 --> 01:00:08.000
Segunda frase.
`;

describe('parseSubtitles', () => {
  it('parses SRT with BOM, CRLF and multiline cues', () => {
    expect(parseSubtitles(SRT, 'srt')).toEqual([
      { startMs: 1000, endMs: 4500, text: 'El paro bajó un 5 % en 2024.' },
      { startMs: 5000, endMs: 8000, text: 'Es una gran noticia.' },
    ]);
  });

  it('parses VTT with notes, styles, ids, settings, tags and hours', () => {
    expect(parseSubtitles(VTT, 'vtt')).toEqual([
      { startMs: 1000, endMs: 4500, text: 'El paro bajó un 5 % en 2024.' },
      { startMs: 3_605_250, endMs: 3_608_000, text: 'Segunda frase.' },
    ]);
  });

  it('rejects invalid input', () => {
    expect(() => parseSubtitles('1\n00:00:01,000 --> 00:00:00,500\nx\n', 'srt')).toThrow(/ends before/);
    expect(() => parseSubtitles('1\n00:00:1,000 --> 00:00:02,000\nx\n', 'srt')).toThrow(/invalid timestamp/);
    expect(() => parseSubtitles('1\n00:00:61,000 --> 00:01:02,000\nx\n', 'srt')).toThrow(/invalid timestamp/);
    expect(() => parseSubtitles('1\nsin tiempo\n', 'srt')).toThrow(/without timing/);
    expect(() => parseSubtitles('00:00:01.000 --> 00:00:02.000\nx\n', 'vtt')).toThrow(/WEBVTT/);
    expect(() => parseSubtitles('', 'srt')).toThrow(/no cues/);
    expect(() =>
      parseSubtitles('1\n00:00:05,000 --> 00:00:06,000\na\n\n2\n00:00:01,000 --> 00:00:02,000\nb\n', 'srt'),
    ).toThrow(/out of order/);
  });
});

describe('locateClaim', () => {
  const segs = [
    { startMs: 0, endMs: 1000, text: 'Buenas tardes.' },
    { startMs: 1000, endMs: 4000, text: 'El paro bajó' },
    { startMs: 4000, endMs: 6000, text: 'un 5 % en 2024.' },
    { startMs: 6000, endMs: 8000, text: 'Gracias.' },
    { startMs: 8000, endMs: 9000, text: 'Fin.' },
  ];
  it('spans segments and returns surrounding context', () => {
    expect(locateClaim(segs, 'El paro bajó  un 5 %')).toEqual({
      startMs: 1000,
      endMs: 6000,
      context: 'Buenas tardes. El paro bajó un 5 % en 2024. Gracias.',
    });
  });
  it('locates within a single later segment', () => {
    expect(locateClaim(segs, 'Gracias.')).toMatchObject({ startMs: 6000, endMs: 8000 });
    expect(locateClaim(segs, 'Fin.')).toMatchObject({ startMs: 8000, endMs: 9000 });
  });
  it('rejects text that is not literally in the transcript', () => {
    expect(locateClaim(segs, 'El paro bajó un 6 %')).toBeNull();
    expect(locateClaim(segs, 'el paro bajó')).toBeNull();
    expect(locateClaim(segs, '  ')).toBeNull();
  });
});
