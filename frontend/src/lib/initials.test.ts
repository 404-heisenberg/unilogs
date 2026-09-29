import { describe, expect, it } from 'vitest';
import { initialsFromName } from './initials';

describe('initialsFromName', () => {
  it('takes the first and last name', () => {
    expect(initialsFromName('Renda M')).toBe('RM');
    expect(initialsFromName('Jared Bharath')).toBe('JB');
  });

  it('ignores extra middle names', () => {
    expect(initialsFromName('Mary Jane Watson')).toBe('MW');
  });

  it('handles a single name', () => {
    expect(initialsFromName('Prince')).toBe('PR');
  });

  it('is case insensitive', () => {
    expect(initialsFromName('renda m')).toBe('RM');
  });

  it('tolerates extra and missing whitespace', () => {
    expect(initialsFromName('  Renda   M  ')).toBe('RM');
  });

  it('returns an empty string for missing or blank names', () => {
    expect(initialsFromName('')).toBe('');
    expect(initialsFromName('   ')).toBe('');
    expect(initialsFromName(null)).toBe('');
    expect(initialsFromName(undefined)).toBe('');
  });
});
