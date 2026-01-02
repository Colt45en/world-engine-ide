// Minimal LMN core utilities used by resonance adapters.

export type TokenType =
  | 'keyword'
  | 'identifier'
  | 'operator'
  | 'literal'
  | 'punctuation'
  | 'comment'
  | 'unknown';

export type Token = {
  type: TokenType;
  value: string;
  pos: number;
  end: number;
};

export function fnv1a32(input: string): number {
  // 32-bit FNV-1a
  let hash = 0x811c9dc5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0) ?? 0;
    // hash *= 16777619 (with 32-bit overflow)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

const KEYWORDS = new Set([
  'let',
  'const',
  'var',
  'if',
  'else',
  'while',
  'for',
  'do',
  'break',
  'continue',
  'return',
  'function',
  'class',
  'new',
  'import',
  'from',
  'export',
  'true',
  'false',
  'null',
  'undefined',
  // LMN-ish DSL keywords
  'emit',
  'at',
  'lattice',
  'in',
  'scope',
]);

const MULTI_CHAR_OPERATORS = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '=>',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '<<',
  '>>',
  '**',
];

const SINGLE_CHAR_OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '=',
  '<',
  '>',
  '!',
  '&',
  '|',
  '^',
  '~',
  '?',
  ':',
]);

const PUNCTUATION = new Set(['(', ')', '{', '}', '[', ']', ',', ';', '.']);

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /\w/.test(ch);
}

function isDigit(ch: string): boolean {
  return /\d/.test(ch);
}

export function lex(src: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < src.length) {
    index = skipWhitespace(src, index);
    if (index >= src.length) break;

    const match =
      tryReadLineComment(src, index) ||
      tryReadBlockComment(src, index) ||
      tryReadStringLiteral(src, index) ||
      tryReadNumberLiteral(src, index) ||
      tryReadIdentifierOrKeyword(src, index) ||
      tryReadOperator(src, index) ||
      tryReadPunctuation(src, index) ||
      readUnknown(src, index);

    tokens.push(match.token);
    index = match.nextIndex;
  }

  return tokens;
}

function skipWhitespace(src: string, start: number): number {
  let i = start;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    break;
  }
  return i;
}

type ReadResult = { token: Token; nextIndex: number };

function tryReadLineComment(src: string, start: number): ReadResult | null {
  if (!(src[start] === '/' && src[start + 1] === '/')) return null;
  let i = start + 2;
  while (i < src.length && src[i] !== '\n') i++;
  return {
    token: { type: 'comment', value: src.slice(start, i), pos: start, end: i },
    nextIndex: i,
  };
}

function tryReadBlockComment(src: string, start: number): ReadResult | null {
  if (!(src[start] === '/' && src[start + 1] === '*')) return null;
  let i = start + 2;
  while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
  if (i < src.length) i += 2;
  return {
    token: { type: 'comment', value: src.slice(start, i), pos: start, end: i },
    nextIndex: i,
  };
}

function tryReadStringLiteral(src: string, start: number): ReadResult | null {
  const quote = src[start];
  if (quote !== '"' && quote !== "'" && quote !== '`') return null;

  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) {
      i++;
      break;
    }
    i++;
  }
  return {
    token: { type: 'literal', value: src.slice(start, i), pos: start, end: i },
    nextIndex: i,
  };
}

function tryReadNumberLiteral(src: string, start: number): ReadResult | null {
  const ch = src[start];
  const next = src[start + 1] ?? '';
  if (!(isDigit(ch) || (ch === '.' && isDigit(next)))) return null;

  let i = start;
  if (src[i] === '.') i++;
  while (i < src.length && isDigit(src[i])) i++;
  if (src[i] === '.' && isDigit(src[i + 1] ?? '')) {
    i++;
    while (i < src.length && isDigit(src[i])) i++;
  }

  return {
    token: { type: 'literal', value: src.slice(start, i), pos: start, end: i },
    nextIndex: i,
  };
}

function tryReadIdentifierOrKeyword(src: string, start: number): ReadResult | null {
  if (!isIdentStart(src[start])) return null;
  let i = start + 1;
  while (i < src.length && isIdentPart(src[i])) i++;
  const value = src.slice(start, i);
  const type: TokenType = KEYWORDS.has(value) ? 'keyword' : 'identifier';
  return { token: { type, value, pos: start, end: i }, nextIndex: i };
}

function tryReadOperator(src: string, start: number): ReadResult | null {
  for (const op of MULTI_CHAR_OPERATORS) {
    if (src.startsWith(op, start)) {
      const end = start + op.length;
      return { token: { type: 'operator', value: op, pos: start, end }, nextIndex: end };
    }
  }

  const ch = src[start];
  if (!SINGLE_CHAR_OPERATORS.has(ch)) return null;
  return {
    token: { type: 'operator', value: ch, pos: start, end: start + 1 },
    nextIndex: start + 1,
  };
}

function tryReadPunctuation(src: string, start: number): ReadResult | null {
  const ch = src[start];
  if (!PUNCTUATION.has(ch)) return null;
  return {
    token: { type: 'punctuation', value: ch, pos: start, end: start + 1 },
    nextIndex: start + 1,
  };
}

function readUnknown(src: string, start: number): ReadResult {
  const ch = src[start];
  return {
    token: { type: 'unknown', value: ch, pos: start, end: start + 1 },
    nextIndex: start + 1,
  };
}
