import type { ChronicalUnfold } from './resonance-word-math';

export type UnfoldMarker = {
  token: string;
  pos: number;
  end: number;
};

type ParsedMarker = {
  token: string;
  start: number;
  end: number;
  replacement: string;
};

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /\w/.test(ch);
}

function parseMarkerAt(src: string, start: number): ParsedMarker | null {
  if (src[start] !== '&') return null;

  const next = src[start + 1] ?? '';
  if (!isIdentStart(next)) return null;

  let i = start + 1; // after '&'
  const headStart = i;
  while (i < src.length && isIdentPart(src[i])) i++;
  const head = src.slice(headStart, i);

  let token = head;
  if (head === 'token' && src[i] === ':') {
    i++; // skip ':'
    const valueStart = i;
    while (i < src.length && isIdentPart(src[i])) i++;
    const value = src.slice(valueStart, i);
    if (value.length > 0) token = value;
  }

  return { token, start, end: i, replacement: token };
}

/**
 * Extracts '&token' markers from source.
 * - Returns a cleanSource with the leading '&' removed.
 * - Returns markers with positions in the original source.
 * - Returns aggregated unfolds for each token.
 */
export function unfoldFromSource(src: string): {
  cleanSource: string;
  markers: UnfoldMarker[];
  unfolds: ChronicalUnfold[];
} {
  const markers: UnfoldMarker[] = [];
  const unfoldByToken = new Map<string, { positions: number[] }>();

  let clean = '';
  let i = 0;

  while (i < src.length) {
    const marker = parseMarkerAt(src, i);
    if (!marker) {
      clean += src[i];
      i++;
      continue;
    }

    markers.push({ token: marker.token, pos: marker.start, end: marker.end });

    const bucket = unfoldByToken.get(marker.token) ?? { positions: [] };
    bucket.positions.push(marker.start);
    unfoldByToken.set(marker.token, bucket);

    clean += marker.replacement;
    i = marker.end;
  }

  const unfolds: ChronicalUnfold[] = Array.from(unfoldByToken.entries()).map(([token, data]) => ({
    token,
    occurrences: data.positions.length,
    positions: data.positions.slice(),
  }));

  return { cleanSource: clean, markers, unfolds };
}
