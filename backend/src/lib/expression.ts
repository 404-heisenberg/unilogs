export type AST =
  | { kind: 'number'; value: number }
  | { kind: 'field'; name: string }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: AST; right: AST }
  | { kind: 'unary'; op: '-'; operand: AST };

export type FieldValues = Record<string, unknown>;

export class ExpressionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ExpressionError';
  }
}

const MAX_EXPR_LENGTH = 500;
const MAX_TOKENS = 100;
const MAX_DEPTH = 20;

type TokenKind = 'num' | 'ident' | 'op' | 'lparen' | 'rparen';

interface Token {
  kind: TokenKind;
  text: string;
  start: number;
}

function lex(input: string): Token[] {
  if (input.length > MAX_EXPR_LENGTH) {
    throw new ExpressionError(`Expression exceeds ${MAX_EXPR_LENGTH} characters`, 'TOO_LONG');
  }

  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    if (c >= '0' && c <= '9') {
      const start = i;
      while (i < input.length && /[0-9.]/.test(input[i])) i++;
      tokens.push({ kind: 'num', text: input.slice(start, i), start });
      continue;
    }

    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ kind: 'op', text: c, start: i });
      i++;
      continue;
    }

    if (c === '(') {
      tokens.push({ kind: 'lparen', text: c, start: i });
      i++;
      continue;
    }

    if (c === ')') {
      tokens.push({ kind: 'rparen', text: c, start: i });
      i++;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i++;
      tokens.push({ kind: 'ident', text: input.slice(start, i), start });
      continue;
    }

    throw new ExpressionError(`Unexpected character "${c}" at position ${i}`, 'UNEXPECTED_CHAR');
  }

  if (tokens.length === 0) {
    throw new ExpressionError('Expression is empty', 'EMPTY');
  }
  if (tokens.length > MAX_TOKENS) {
    throw new ExpressionError(
      `Expression has too many tokens (max ${MAX_TOKENS})`,
      'TOO_MANY_TOKENS',
    );
  }

  return tokens;
}

interface ParseState {
  tokens: Token[];
  fields: Set<string>;
  depth: number;
}

interface PartialParse {
  ast: AST;
  pos: number;
}

export function parseExpression(input: string, fieldNames: string[]): AST {
  const tokens = lex(input);
  const state: ParseState = {
    tokens,
    fields: new Set(fieldNames),
    depth: 0,
  };

  const results = parseExpr(state, 0);
  const complete = results.filter((r) => r.pos === tokens.length);

  if (complete.length === 0) {
    throw new ExpressionError('Expression could not be parsed', 'PARSE_ERROR');
  }

  if (complete.length > 1) {
    throw new ExpressionError(
      'Expression is ambiguous: multiple valid field-name segmentations',
      'AMBIGUOUS',
    );
  }

  return complete[0].ast;
}

function parseExpr(state: ParseState, pos: number): PartialParse[] {
  const out: PartialParse[] = [];
  const stack = parseTerm(state, pos);
  out.push(...stack);

  while (stack.length > 0) {
    const node = stack.pop()!;
    const tok = state.tokens[node.pos];
    if (!tok || tok.kind !== 'op' || (tok.text !== '+' && tok.text !== '-')) {
      continue;
    }
    const rhs = parseTerm(state, node.pos + 1);
    for (const r of rhs) {
      const combined: PartialParse = {
        ast: {
          kind: 'binary',
          op: tok.text as '+' | '-',
          left: node.ast,
          right: r.ast,
        },
        pos: r.pos,
      };
      stack.push(combined);
      out.push(combined);
    }
  }

  return out;
}

function parseTerm(state: ParseState, pos: number): PartialParse[] {
  const out: PartialParse[] = [];
  const stack = parseFactor(state, pos);
  out.push(...stack);

  while (stack.length > 0) {
    const node = stack.pop()!;
    const tok = state.tokens[node.pos];
    if (!tok || tok.kind !== 'op' || (tok.text !== '*' && tok.text !== '/')) {
      continue;
    }
    const rhs = parseFactor(state, node.pos + 1);
    for (const r of rhs) {
      const combined: PartialParse = {
        ast: {
          kind: 'binary',
          op: tok.text as '*' | '/',
          left: node.ast,
          right: r.ast,
        },
        pos: r.pos,
      };
      stack.push(combined);
      out.push(combined);
    }
  }

  return out;
}

function parseFactor(state: ParseState, pos: number): PartialParse[] {
  const tok = state.tokens[pos];
  if (!tok) return [];

  if (tok.kind === 'num') {
    const value = Number(tok.text);
    if (!Number.isFinite(value)) {
      throw new ExpressionError(`Invalid number "${tok.text}"`, 'INVALID_NUMBER');
    }
    return [{ ast: { kind: 'number', value }, pos: pos + 1 }];
  }

  if (tok.kind === 'op' && tok.text === '-') {
    if (state.depth + 1 > MAX_DEPTH) {
      throw new ExpressionError('Expression is too deeply nested', 'TOO_DEEP');
    }
    const inner = parseFactor({ ...state, depth: state.depth + 1 }, pos + 1);
    return inner.map((r) => ({
      ast: { kind: 'unary', op: '-', operand: r.ast } as AST,
      pos: r.pos,
    }));
  }

  if (tok.kind === 'lparen') {
    if (state.depth + 1 > MAX_DEPTH) {
      throw new ExpressionError('Expression is too deeply nested', 'TOO_DEEP');
    }
    const inner = parseExpr({ ...state, depth: state.depth + 1 }, pos + 1);
    const out: PartialParse[] = [];
    for (const r of inner) {
      const closing = state.tokens[r.pos];
      if (closing && closing.kind === 'rparen') {
        out.push({ ast: r.ast, pos: r.pos + 1 });
      }
    }
    return out;
  }

  if (tok.kind === 'ident') {
    return parseIdentifier(state, pos);
  }

  return [];
}

function parseIdentifier(state: ParseState, pos: number): PartialParse[] {
  const tokens = state.tokens;
  let end = pos + 1;
  while (end < tokens.length && tokens[end].kind === 'ident') end++;

  const alternatives: { name: string; consumed: number }[] = [];
  for (let k = 1; k <= end - pos; k++) {
    alternatives.push({
      name: tokens
        .slice(pos, pos + k)
        .map((t) => t.text)
        .join(' '),
      consumed: k,
    });
  }

  const matches = alternatives.filter((a) => state.fields.has(a.name));

  if (matches.length === 0) {
    const attempted = alternatives[alternatives.length - 1].name;
    throw new ExpressionError(`Unknown field "${attempted}"`, 'UNKNOWN_FIELD');
  }

  return matches.map((m) => ({
    ast: { kind: 'field', name: m.name } as AST,
    pos: pos + m.consumed,
  }));
}

export function evaluate(ast: AST, values: FieldValues): number | null {
  switch (ast.kind) {
    case 'number':
      return ast.value;

    case 'field': {
      const raw = values[ast.name];
      if (raw === undefined || raw === null) return null;
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) return null;
      return n;
    }

    case 'unary': {
      const inner = evaluate(ast.operand, values);
      return inner === null ? null : -inner;
    }

    case 'binary': {
      const left = evaluate(ast.left, values);
      const right = evaluate(ast.right, values);
      if (left === null || right === null) return null;

      switch (ast.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right === 0 ? null : left / right;
      }
    }
  }
}
