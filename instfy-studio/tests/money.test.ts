import { describe, expect, it } from 'vitest';
import {
  applyBasisPoints,
  centsToBRL,
  centsToBRLCompact,
  parseBRLToCents,
  splitInstalments,
  sumCents,
  MoneyError,
} from '../lib/money';

describe('parseBRLToCents', () => {
  it('parses pt-BR formatted strings', () => {
    expect(parseBRLToCents('R$ 22.000,00')).toBe(2200000);
    expect(parseBRLToCents('1.234,56')).toBe(123456);
    expect(parseBRLToCents('5000')).toBe(500000);
    expect(parseBRLToCents('8,50')).toBe(850);
  });

  it('parses en-US formatted strings', () => {
    expect(parseBRLToCents('1234.56')).toBe(123456);
    expect(parseBRLToCents('1,234.56')).toBe(123456);
  });

  it('parses numbers without float drift', () => {
    expect(parseBRLToCents(0.1 + 0.2)).toBe(30);
    expect(parseBRLToCents(1234.565)).toBe(123457);
  });

  it('rejects garbage', () => {
    expect(() => parseBRLToCents('abc')).toThrow(MoneyError);
  });
});

describe('centsToBRL', () => {
  it('formats with pt-BR grouping', () => {
    expect(centsToBRL(2200000)).toBe('R$ 22.000,00');
    expect(centsToBRL(123456)).toBe('R$ 1.234,56');
    expect(centsToBRL(-500)).toBe('-R$ 5,00');
    expect(centsToBRL(0)).toBe('R$ 0,00');
  });

  it('formats compact headline figures', () => {
    expect(centsToBRLCompact(2200000)).toBe('R$ 22.000');
    expect(centsToBRLCompact(123456)).toBe('R$ 1.234,56');
  });
});

describe('applyBasisPoints', () => {
  it('computes 20% of 10.000 exactly', () => {
    expect(applyBasisPoints(1000000, 2000)).toBe(200000);
  });

  it('rounds half away from zero', () => {
    // 1 cent * 50% = 0.5 cent -> 1 cent
    expect(applyBasisPoints(1, 5000)).toBe(1);
    expect(applyBasisPoints(-1, 5000)).toBe(-1);
    // 3 cents * 33.33% = 0.9999 -> 1
    expect(applyBasisPoints(3, 3333)).toBe(1);
  });

  it('never loses precision on repeated application', () => {
    let total = 0;
    for (let i = 0; i < 1000; i += 1) total += applyBasisPoints(1000, 1000);
    expect(total).toBe(100000);
  });
});

describe('splitInstalments', () => {
  it('splits evenly and conserves the total', () => {
    const parts = splitInstalments(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(sumCents(parts)).toBe(1000);
  });

  it('applies weighted 40/30/30 to the reference implantation', () => {
    const parts = splitInstalments(2200000, 3, [4000, 3000, 3000]);
    expect(parts).toEqual([880000, 660000, 660000]);
    expect(sumCents(parts)).toBe(2200000);
  });

  it('conserves the total on awkward weights', () => {
    const parts = splitInstalments(100003, 3, [3333, 3333, 3334]);
    expect(sumCents(parts)).toBe(100003);
  });

  it('rejects weights that do not sum to 100%', () => {
    expect(() => splitInstalments(1000, 2, [5000, 4000])).toThrow(MoneyError);
  });
});
