// src/resonance/resonance-input.ts
// Standalone adapter: derives deterministic resonance inputs from source text.

import { fnv1a32, lex, type Token } from '../core/lmn-core';
import { unfoldFromSource, type UnfoldMarker } from '../core/resonance-unfold';

export type LMNSegment = {
  token: string;
  tokenType:
    | 'keyword'
    | 'identifier'
    | 'operator'
    | 'literal'
    | 'punctuation'
    | 'comment'
    | 'unknown';
  pos: number;
  end: number;
};

export const LMN_MAPPING_VERSION = 'resonance-input/v1';

export type ResonanceInput = {
  signal: Int8Array;
  segments?: LMNSegment[];
  transition_matrix: Float32Array;
  triplet_matrix: Float32Array;
  mappingVersion: string;
  sourceHash?: string;
};

export type ResonanceUnfold = import('../core/resonance-word-math').ChronicalUnfold;

export type ResonanceInputWithUnfold = ResonanceInput & {
  cleanSource: string;
  unfoldMarkers: UnfoldMarker[];
  unfolds: ResonanceUnfold[];
};

export type ResonanceInputOptions = {
  includeSegments?: boolean;
  unfold?: boolean;
};

function tokenToSegment(t: Token): LMNSegment {
  const tokenType = (t.type as LMNSegment['tokenType']) ?? 'unknown';
  return { token: t.value, tokenType, pos: t.pos, end: t.end };
}

export function lmnSegmentsFromSource(src: string): LMNSegment[] {
  return lex(src).map(tokenToSegment);
}

function tokenTypeToState3(tokenType: LMNSegment['tokenType']): -1 | 0 | 1 {
  // Deterministic 3-state projection.
  // -1: structure/ops, 0: literals/noise, +1: symbols/keywords
  switch (tokenType) {
    case 'operator':
    case 'punctuation':
      return -1;
    case 'keyword':
    case 'identifier':
      return 1;
    case 'literal':
    case 'comment':
    case 'unknown':
    default:
      return 0;
  }
}

export function lmnSignalFromSegments(segs: LMNSegment[]): number[] {
  return segs.map((s) => tokenTypeToState3(s.tokenType));
}

function stateIndex3(v: number): 0 | 1 | 2 {
  // Map -1,0,1 => 0,1,2
  if (v < 0) return 0;
  if (v > 0) return 2;
  return 1;
}

export function transitionMatrix3(signal: number[]): number[] {
  // Row-major 3x3 transition probabilities.
  const m = new Array<number>(9).fill(0);
  if (!signal || signal.length < 2) return m;

  let total = 0;
  for (let i = 0; i < signal.length - 1; i++) {
    const a = stateIndex3(signal[i]);
    const b = stateIndex3(signal[i + 1]);
    m[a * 3 + b] += 1;
    total += 1;
  }

  if (total > 0) {
    for (let i = 0; i < 9; i++) m[i] = m[i] / total;
  }
  return m;
}

export function tripletMatrix27(signal: number[]): number[] {
  // Row-major 3x3x3 triplet probabilities.
  const m = new Array<number>(27).fill(0);
  if (!signal || signal.length < 3) return m;

  let total = 0;
  for (let i = 0; i < signal.length - 2; i++) {
    const a = stateIndex3(signal[i]);
    const b = stateIndex3(signal[i + 1]);
    const c = stateIndex3(signal[i + 2]);
    m[a * 9 + b * 3 + c] += 1;
    total += 1;
  }

  if (total > 0) {
    for (let i = 0; i < 27; i++) m[i] = m[i] / total;
  }
  return m;
}

export function resonanceInputFromSource(src: string, includeSegments?: boolean): ResonanceInput;
export function resonanceInputFromSource(
  src: string,
  options?: ResonanceInputOptions,
): ResonanceInput | ResonanceInputWithUnfold;
export function resonanceInputFromSource(
  src: string,
  includeSegmentsOrOptions: boolean | ResonanceInputOptions = false,
): ResonanceInput | ResonanceInputWithUnfold {
  const options: ResonanceInputOptions =
    typeof includeSegmentsOrOptions === 'boolean'
      ? { includeSegments: includeSegmentsOrOptions }
      : (includeSegmentsOrOptions ?? {});

  const includeSegments = Boolean(options.includeSegments);
  if (options.unfold) {
    return resonanceInputFromSourceWithUnfold(src, includeSegments);
  }

  const segments = includeSegments ? lmnSegmentsFromSource(src) : undefined;
  const segs = segments || lmnSegmentsFromSource(src);
  const signalArray = lmnSignalFromSegments(segs);

  const signal = new Int8Array(signalArray);
  const transition_matrix = new Float32Array(transitionMatrix3(signalArray));
  const triplet_matrix = new Float32Array(tripletMatrix27(signalArray));
  const sourceHash = fnv1a32(src).toString(16);

  return {
    signal,
    segments,
    transition_matrix,
    triplet_matrix,
    mappingVersion: LMN_MAPPING_VERSION,
    sourceHash,
  };
}

// Opt-in API: only unfolds when '&token' markers are present.
export function resonanceInputFromSourceWithUnfold(
  src: string,
  includeSegments = false,
): ResonanceInputWithUnfold {
  const { cleanSource, markers, unfolds } = unfoldFromSource(src);
  const base = resonanceInputFromSource(cleanSource, includeSegments);
  return {
    ...base,
    cleanSource,
    unfoldMarkers: markers,
    unfolds,
  };
}
