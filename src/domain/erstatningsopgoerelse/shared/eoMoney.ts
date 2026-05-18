import { z } from 'zod';
import { roundByMethod } from '../../../utils/rounding';
import type { Calculable, MoneyKroner, MoneyOre } from './eoTypes';

export const moneyOreSchema = z.number().int();

export const asCalculable = <T>(value: T): Extract<Calculable<T>, { status: 'ok' }> => ({ status: 'ok', value });

export const ensureMoneyOre = (value: number): MoneyOre => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('MoneyOre skal være et heltal');
  }
  return value as MoneyOre;
};

export const clampMoneyOreToZero = (value: MoneyOre): MoneyOre => {
  return value < 0 ? ensureMoneyOre(0) : value;
};

export const roundKroner = (value: number): number => roundByMethod(value, 2, 'halfAwayFromZero');

export const roundHeleKroner = (value: number): number => roundByMethod(value, 0, 'halfAwayFromZero');

export const toOre = (value: MoneyKroner): MoneyOre => {
  if (!Number.isFinite(value)) {
    throw new Error('Ugyldigt beløb: ikke et endeligt tal');
  }
  const scaled = value * 100;
  const rounded = roundByMethod(scaled, 0, 'halfAwayFromZero');
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
