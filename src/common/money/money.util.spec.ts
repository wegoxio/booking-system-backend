import {
  calculateLineTotal,
  moneyToMinorUnits,
  normalizeCurrency,
  normalizeMoney,
} from './money.util';

describe('money utilities', () => {
  it('calculates FLAT for one and multiple people without multiplying', () => {
    expect(calculateLineTotal('18.50', 1, 'FLAT')).toBe('18.50');
    expect(calculateLineTotal('18.50', 4, 'FLAT')).toBe('18.50');
  });

  it('calculates PER_PERSON exactly', () => {
    expect(calculateLineTotal('18.50', 1, 'PER_PERSON')).toBe('18.50');
    expect(calculateLineTotal('18.50', 4, 'PER_PERSON')).toBe('74.00');
    expect(calculateLineTotal('0.10', 3, 'PER_PERSON')).toBe('0.30');
  });

  it('normalizes valid money and currency', () => {
    expect(normalizeMoney(12.5)).toBe('12.50');
    expect(moneyToMinorUnits('12.05')).toBe(1205n);
    expect(normalizeCurrency('eur')).toBe('EUR');
  });

  it('rejects excessive monetary precision', () => {
    expect(() => normalizeMoney('1.001')).toThrow();
  });
});
