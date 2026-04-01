import { z } from 'zod';
import { roundByMethod } from '../../../utils/rounding';
import type { MoneyKroner, MoneyOre } from './eoPdfModelTypes';

export const moneyOreSchema = z.number().int();

export const ensureMoneyOre = (value: number): MoneyOre => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('MoneyOre skal være et heltal');
  }
  return value as MoneyOre;
};

// Totallinjer må aldrig være negative (max(0, beregnet)).
export const clampMoneyOreToZero = (value: MoneyOre): MoneyOre => {
  return value < 0 ? ensureMoneyOre(0) : value;
};

// Afrunding til 2 decimaler med "half away from zero" (samme regel på tværs af hele PDF-modellen)
export const roundKroner = (value: number): number => roundByMethod(value, 2, 'halfAwayFromZero');

export const toOre = (value: MoneyKroner): MoneyOre => {
  if (!Number.isFinite(value)) {
    throw new Error('Ugyldigt beløb: ikke et endeligt tal');
  }
  const scaled = value * 100;
  const rounded = roundByMethod(scaled, 0, 'halfAwayFromZero');
  // Epsilon 1e-4 for at undgå false positives fra floating-point afrunding ved store beløb.
  // Verificeret: toOre(999999.99) er OK, toOre(1.005) kaster (mere end 2 decimaler).
  if (Math.abs(scaled - rounded) > 1e-4) {
    throw new Error('Beløb har flere end 2 decimaler');
  }
  return ensureMoneyOre(rounded);
};

export const fromOre = (value: MoneyOre): MoneyKroner => value / 100;

export const scaleMoneyOre = (value: MoneyOre, factor: number): MoneyOre => {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
    throw new Error('Ugyldig faktor for MoneyOre-skalering');
  }
  return ensureMoneyOre(roundByMethod(value * factor, 0, 'halfAwayFromZero'));
};
