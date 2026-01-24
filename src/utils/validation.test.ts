/**
 * Validation Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import { parsePositiveInt, parseNonNegativeInt } from './validation.js';

describe('parsePositiveInt', () => {
  it('should parse valid positive integers', () => {
    expect(parsePositiveInt('10', 'count')).toEqual({ valid: true, value: 10 });
    expect(parsePositiveInt('1', 'count')).toEqual({ valid: true, value: 1 });
    expect(parsePositiveInt('999', 'count')).toEqual({ valid: true, value: 999 });
  });

  it('should reject non-numeric strings', () => {
    const result = parsePositiveInt('abc', 'count');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a valid number');
  });

  it('should reject zero', () => {
    const result = parsePositiveInt('0', 'count');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject negative numbers', () => {
    const result = parsePositiveInt('-5', 'count');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a positive number');
  });

  it('should reject empty string', () => {
    const result = parsePositiveInt('', 'count');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a valid number');
  });

  it('should respect min option', () => {
    expect(parsePositiveInt('5', 'count', { min: 10 }).valid).toBe(false);
    expect(parsePositiveInt('10', 'count', { min: 10 }).valid).toBe(true);
    expect(parsePositiveInt('15', 'count', { min: 10 }).valid).toBe(true);
  });

  it('should respect max option', () => {
    expect(parsePositiveInt('100', 'count', { max: 50 }).valid).toBe(false);
    expect(parsePositiveInt('50', 'count', { max: 50 }).valid).toBe(true);
    expect(parsePositiveInt('25', 'count', { max: 50 }).valid).toBe(true);
  });

  it('should include field name in error messages', () => {
    const result = parsePositiveInt('abc', 'max-iterations');
    expect(result.error).toContain('max-iterations');
  });
});

describe('parseNonNegativeInt', () => {
  it('should parse valid non-negative integers', () => {
    expect(parseNonNegativeInt('0', 'timeout')).toEqual({ valid: true, value: 0 });
    expect(parseNonNegativeInt('10', 'timeout')).toEqual({ valid: true, value: 10 });
  });

  it('should reject non-numeric strings', () => {
    const result = parseNonNegativeInt('abc', 'timeout');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a valid number');
  });

  it('should reject negative numbers', () => {
    const result = parseNonNegativeInt('-1', 'timeout');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be a non-negative number');
  });

  it('should include field name in error messages', () => {
    const result = parseNonNegativeInt('-5', 'timeout');
    expect(result.error).toContain('timeout');
  });
});
