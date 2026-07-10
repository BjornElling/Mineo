import { z } from 'zod';
import { roundByMethod } from '../../utils/rounding';

/**
 * Et helt ørebeløb. Brandet gør det umuligt at lade vilkårlige `number`-værdier
 * passere som penge uden først at validere dem gennem dette modul.
 */
export const moneyOreSchema = z.number().int().brand<'MoneyOre'>();

export type MoneyOre = z.infer<typeof moneyOreSchema>;

/** Den eneste konstruktor fra et allerede øre-skaleret tal. */
export const moneyOre = (value: number): MoneyOre => {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error('MoneyOre skal være et heltal');
  }
  return moneyOreSchema.parse(value);
};

export const zeroMoneyOre = (): MoneyOre => moneyOre(0);

export const addMoneyOre = (left: MoneyOre, right: MoneyOre): MoneyOre =>
  moneyOre(left + right);

export const subtractMoneyOre = (left: MoneyOre, right: MoneyOre): MoneyOre =>
  moneyOre(left - right);

export const sumMoneyOre = (values: Iterable<MoneyOre>): MoneyOre => {
  let total = 0;
  for (const value of values) total += value;
  return moneyOre(total);
};

export const clampMoneyOreToZero = (value: MoneyOre): MoneyOre =>
  value < 0 ? zeroMoneyOre() : value;

export const roundKroner = (value: number): number =>
  roundByMethod(value, 2, 'halfAwayFromZero');

export const roundHeleKroner = (value: number): number =>
  roundByMethod(value, 0, 'halfAwayFromZero');

/** Konverterer et kronebeløb med højst to decimaler til validerede øre. */
export const fromKroner = (value: number): MoneyOre => {
  if (!Number.isFinite(value)) {
    throw new Error('Ugyldigt beløb: ikke et endeligt tal');
  }
  const scaled = value * 100;
  const rounded = roundByMethod(scaled, 0, 'halfAwayFromZero');
  if (Math.abs(scaled - rounded) > 1e-4) {
    throw new Error('Beløb har flere end 2 decimaler');
  }
  return moneyOre(rounded);
};

export const toKroner = (value: MoneyOre): number => value / 100;

export const scaleMoneyOre = (value: MoneyOre, factor: number): MoneyOre => {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
    throw new Error('Ugyldig faktor for MoneyOre-skalering');
  }
  return moneyOre(roundByMethod(value * factor, 0, 'halfAwayFromZero'));
};
