export interface Segment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface LocatedClaim {
  startMs: number;
  endMs: number;
  context: string;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Texto continuo de los segmentos, unido por espacios. */
export function joinSegments(segments: Segment[]): string {
  return segments.map((s) => s.text).join(' ');
}

/**
 * Tramos de `size` segmentos con `overlap` de solape, para que una frase partida entre cues
 * quede entera en al menos un tramo.
 */
export function windows(segments: Segment[], size = 12, overlap = 3): Segment[][] {
  if (overlap >= size) throw new Error('overlap must be smaller than size');
  const out: Segment[][] = [];
  for (let i = 0; i < segments.length; i += size - overlap) {
    out.push(segments.slice(i, i + size));
    if (i + size >= segments.length) break;
  }
  return out;
}

/**
 * Localiza una cita literal en la transcripción. Devuelve null si no es una subcadena exacta
 * (salvo espacios): un claim que no está en la transcripción no se acepta.
 * Timestamps y contexto salen siempre de los segmentos, nunca del modelo.
 */
export function locateClaim(segments: Segment[], literal: string): LocatedClaim | null {
  const needle = collapse(literal);
  if (!needle) return null;
  const offsets: number[] = [];
  let full = '';
  for (const s of segments) {
    if (full) full += ' ';
    offsets.push(full.length);
    full += s.text;
  }
  const at = full.indexOf(needle);
  if (at === -1) return null;
  const segAt = (pos: number) => {
    let idx = 0;
    for (let k = 0; k < offsets.length; k++) if (offsets[k]! <= pos) idx = k;
    return idx;
  };
  const first = segAt(at);
  const last = segAt(at + needle.length - 1);
  const context = segments
    .slice(Math.max(0, first - 1), last + 2)
    .map((s) => s.text)
    .join(' ');
  return { startMs: segments[first]!.startMs, endMs: segments[last]!.endMs, context };
}
