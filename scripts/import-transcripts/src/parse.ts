import type { Segment } from '@polifamia/investigation';

export { locateClaim, type LocatedClaim, type Segment } from '@polifamia/investigation';

const TIME = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/;

function toMs(raw: string, line: number): number {
  const m = TIME.exec(raw.trim());
  if (!m) throw new Error(`line ${line}: invalid timestamp "${raw}"`);
  const [, h = '0', min, s, ms] = m;
  if (Number(min) > 59 || Number(s) > 59) throw new Error(`line ${line}: invalid timestamp "${raw}"`);
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(ms);
}

/** Parser SRT/VTT: un segmento por cue, texto en una línea sin etiquetas VTT. */
export function parseSubtitles(input: string, format: 'srt' | 'vtt'): Segment[] {
  const lines = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  if (format === 'vtt' && !lines[0]?.startsWith('WEBVTT')) throw new Error('line 1: missing WEBVTT header');

  const segments: Segment[] = [];
  let i = format === 'vtt' ? 1 : 0;
  while (i < lines.length) {
    // Saltar líneas vacías y bloques VTT sin cue (NOTE, STYLE, REGION, cabeceras).
    if (!lines[i]!.trim()) {
      i++;
      continue;
    }
    const blockStart = i;
    const block: string[] = [];
    while (i < lines.length && lines[i]!.trim()) block.push(lines[i++]!);
    const arrowAt = block.findIndex((l) => l.includes('-->'));
    if (arrowAt === -1) {
      if (format === 'vtt') continue;
      throw new Error(`line ${blockStart + 1}: cue without timing line`);
    }
    if (arrowAt > 1) throw new Error(`line ${blockStart + 1}: malformed cue`);
    const timingLine = blockStart + arrowAt + 1;
    const [rawStart, rest = ''] = block[arrowAt]!.split('-->');
    const startMs = toMs(rawStart!, timingLine);
    const endMs = toMs(rest.trim().split(/\s+/)[0] ?? '', timingLine);
    if (endMs <= startMs) throw new Error(`line ${timingLine}: cue ends before it starts`);
    const prev = segments.at(-1);
    if (prev && startMs < prev.startMs) throw new Error(`line ${timingLine}: cues out of order`);
    const text = block
      .slice(arrowAt + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) segments.push({ startMs, endMs, text });
  }
  if (segments.length === 0) throw new Error('no cues found');
  return segments;
}
