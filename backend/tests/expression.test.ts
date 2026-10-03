import { describe, expect, it } from 'vitest';
import { parseExpression, evaluate, ExpressionError } from '../src/lib/expression.js';

const FIELDS = ['weight', 'reps', 'hours spent', 'hours', 'rate'];

describe('expression lexer + parser + evaluator', () => {
  describe('arithmetic', () => {
    it('adds', () => {
      expect(evaluate(parseExpression('1 + 2', []), {})).toBe(3);
    });

    it('subtracts', () => {
      expect(evaluate(parseExpression('5 - 3', []), {})).toBe(2);
    });

    it('multiplies', () => {
      expect(evaluate(parseExpression('2 * 3', []), {})).toBe(6);
    });

    it('divides', () => {
      expect(evaluate(parseExpression('10 / 4', []), {})).toBe(2.5);
    });

    it('respects * over +', () => {
      expect(evaluate(parseExpression('1 + 2 * 3', []), {})).toBe(7);
    });

    it('respects parentheses', () => {
      expect(evaluate(parseExpression('(1 + 2) * 3', []), {})).toBe(9);
    });

    it('handles unary minus', () => {
      expect(evaluate(parseExpression('-5 + 3', []), {})).toBe(-2);
    });

    it('handles nested parentheses', () => {
      expect(evaluate(parseExpression('((2 + 3) * (1 + 1))', []), {})).toBe(10);
    });
  });

  describe('field resolution', () => {
    it('resolves a simple field', () => {
      const ast = parseExpression('weight * reps', FIELDS);
      expect(evaluate(ast, { weight: 50, reps: 10 })).toBe(500);
    });

    it('prefers the longest matching field name', () => {
      const ast = parseExpression('hours spent * 2', FIELDS);
      expect(evaluate(ast, { 'hours spent': 3, hours: 100 })).toBe(6);
    });

    it('falls back to the shorter name if longer does not fit', () => {
      const ast = parseExpression('hours * 2', FIELDS);
      expect(evaluate(ast, { hours: 4 })).toBe(8);
    });

    it('rejects unknown identifiers with a clear message', () => {
      let caught: unknown;
      try {
        parseExpression('mystery * 2', FIELDS);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ExpressionError);
      expect((caught as ExpressionError).code).toBe('UNKNOWN_FIELD');
      expect((caught as ExpressionError).message).toContain('mystery');
    });

    it('rejects ambiguous parses', () => {
      // Both "a b" and "a" + "b" could parse
      expect(() => parseExpression('a b', ['a', 'b', 'a b'])).toThrow(/ambiguous/i);
    });
  });

  describe('per-entry skip rules', () => {
    it('skips entries with a missing field value', () => {
      const ast = parseExpression('weight * reps', FIELDS);
      expect(evaluate(ast, { weight: 50 })).toBeNull();
    });

    it('skips entries with a null field value', () => {
      const ast = parseExpression('weight', FIELDS);
      expect(evaluate(ast, { weight: null })).toBeNull();
    });

    it('skips entries with a non-numeric value', () => {
      const ast = parseExpression('weight', FIELDS);
      expect(evaluate(ast, { weight: 'not-a-number' })).toBeNull();
    });

    it('returns null on divide-by-zero (never Infinity)', () => {
      const ast = parseExpression('100 / reps', FIELDS);
      expect(evaluate(ast, { reps: 0 })).toBeNull();
    });

    it('returns null when a sub-expression divides by zero', () => {
      const ast = parseExpression('(weight / reps) + 1', FIELDS);
      expect(evaluate(ast, { weight: 10, reps: 0 })).toBeNull();
    });

    it('coerces numeric strings', () => {
      const ast = parseExpression('weight', FIELDS);
      expect(evaluate(ast, { weight: '42' })).toBe(42);
    });
  });

  describe('input limits and safety', () => {
    it('rejects empty input', () => {
      expect(() => parseExpression('', [])).toThrow(/empty/i);
      expect(() => parseExpression('   ', [])).toThrow(/empty/i);
    });

    it('rejects overlong input', () => {
      const long = '1+' + '1'.repeat(1000);
      expect(() => parseExpression(long, [])).toThrow(/exceeds/i);
    });

    it('rejects too many tokens', () => {
      const many = Array(150).fill('1').join('+');
      expect(() => parseExpression(many, [])).toThrow(/too many tokens/i);
    });

    it('rejects unbalanced parentheses', () => {
      expect(() => parseExpression('(1 + 2', [])).toThrow();
      expect(() => parseExpression('1 + 2)', [])).toThrow();
    });

    it('rejects malformed arithmetic', () => {
      expect(() => parseExpression('1 + * 2', [])).toThrow();
      expect(() => parseExpression('1 2', [])).toThrow();
      expect(() => parseExpression('* 3', [])).toThrow();
    });

    it('cannot execute injected code: semicolon', () => {
      expect(() => parseExpression('1; DROP TABLE users', [])).toThrow();
    });

    it('cannot execute injected code: function call', () => {
      expect(() => parseExpression('process.exit()', [])).toThrow();
    });

    it('cannot execute injected code: empty parens', () => {
      expect(() => parseExpression('()', [])).toThrow();
    });

    it('cannot execute injected code: undefined global', () => {
      expect(() => parseExpression('eval("bad")', [])).toThrow();
    });
  });

  describe('multiline / whitespace tolerance', () => {
    it('tolerates extra whitespace', () => {
      expect(evaluate(parseExpression('  1   +   2  ', []), {})).toBe(3);
    });

    it('tolerates newlines', () => {
      expect(evaluate(parseExpression('1 +\n 2', []), {})).toBe(3);
    });
  });
});
