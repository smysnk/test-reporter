import { describe, expect, it } from 'vitest';
import { divide, multiply } from './math.js';

describe('math helpers', () => {
  it('multiplies values', () => {
    expect(multiply(3, 4)).toBe(12);
  });

  it('fails for an incorrect quotient', () => {
    expect(divide(8, 2)).toBe(5);
  });

  it.skip('skips pending math work', () => {});
});
