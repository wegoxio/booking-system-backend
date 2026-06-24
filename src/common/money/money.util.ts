import { BadRequestException } from '@nestjs/common';

export type PricingModel = 'FLAT' | 'PER_PERSON';

export function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException('La moneda debe ser un código ISO de 3 letras.');
  }
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(0);
  } catch {
    throw new BadRequestException('La moneda indicada no es válida.');
  }
  return currency;
}

export function moneyToMinorUnits(value: string | number): bigint {
  const normalized = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new BadRequestException('El precio debe tener como máximo 2 decimales.');
  }
  const [whole, decimal = ''] = normalized.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
}

export function minorUnitsToMoney(value: bigint): string {
  const whole = value / 100n;
  const decimal = (value % 100n).toString().padStart(2, '0');
  return `${whole}.${decimal}`;
}

export function normalizeMoney(value: string | number): string {
  return minorUnitsToMoney(moneyToMinorUnits(value));
}

export function calculateLineTotal(
  unitPrice: string | number,
  quantity: number,
  pricingModel: PricingModel,
): string {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new BadRequestException('La cantidad debe ser un entero positivo.');
  }
  const unitMinor = moneyToMinorUnits(unitPrice);
  return minorUnitsToMoney(
    pricingModel === 'PER_PERSON' ? unitMinor * BigInt(quantity) : unitMinor,
  );
}
