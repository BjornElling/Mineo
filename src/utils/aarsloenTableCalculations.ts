import type { AarsloenTableRow, Loenperiode } from '../schemas/formSchemas';
import { parseAmount, parsePercentToDecimal } from './formatUtils';

export type AarsloenSatserInput = {
  feriePct?: string | number;
  fritvalgPct?: string | number;
  shSoPct?: string | number;
  storeBededagPct?: string | number;
  pensionPct?: string | number;
};

export type AarsloenRowDerived = {
  ferieberet: number;
  fpFvShSo: number;
  pension: number;
  samlet: number;
};

export const isAarsloenTableCellEffectivelyEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  return value.trim() === '';
};

export const calculateAarsloenRowDerived = (row: AarsloenTableRow, satser: AarsloenSatserInput): AarsloenRowDerived => {
  const ferie = parsePercentToDecimal(satser.feriePct);
  const fritvalg = parsePercentToDecimal(satser.fritvalgPct);
  const shSo = parsePercentToDecimal(satser.shSoPct);
  const storeBededag = parsePercentToDecimal(satser.storeBededagPct);
  const pensionPct = parsePercentToDecimal(satser.pensionPct);

  const totalPct = ferie + fritvalg + shSo + storeBededag;

  const grundloen = parseAmount(row.col2);
  const tillaegInput = parseAmount(row.col3);
  const ikkePensionsgivende = parseAmount(row.col4);
  const atp = parseAmount(row.col5);

  const ferieberet = grundloen + tillaegInput + ikkePensionsgivende;
  const fpFvShSo = totalPct > 0 ? ferieberet * totalPct : 0;

  // Pension beregnes kun på (grundløn + tillæg) og deres forholdsmæssige andel af FP/FV/SH.. (via (1 + totalPct)).
  const pensionBase = (grundloen + tillaegInput) * (1 + totalPct);
  const pension = pensionPct > 0 ? pensionBase * pensionPct : 0;

  // ATP er et tillæg, som lægges til til sidst (ingen afledte ydelser beregnes af ATP).
  const samlet = ferieberet + fpFvShSo + pension + atp;

  return { ferieberet, fpFvShSo, pension, samlet };
};

export const isEffectivelyEmptyCell = isAarsloenTableCellEffectivelyEmpty;

const EDITABLE_KEYS: Array<keyof AarsloenTableRow> = [
  'col0_maaned',
  'col1_maaned',
  'col0_uge',
  'col1_uge',
  'col0_dag',
  'col1_dag',
  'col2',
  'col3',
  'col4',
  'col5',
];

export const isAarsloenRowEffectivelyEmpty = (row: AarsloenTableRow): boolean => {
  for (const key of EDITABLE_KEYS) {
    if (!isAarsloenTableCellEffectivelyEmpty(row[key])) return false;
  }
  return true;
};

export const hasCompletePeriodForLoenperiode = (row: AarsloenTableRow, loenperiode: Loenperiode): boolean => {
  if (loenperiode === 'maaned') return !isAarsloenTableCellEffectivelyEmpty(row.col0_maaned) && !isAarsloenTableCellEffectivelyEmpty(row.col1_maaned);
  if (loenperiode === 'uge') return !isAarsloenTableCellEffectivelyEmpty(row.col0_uge) && !isAarsloenTableCellEffectivelyEmpty(row.col1_uge);
  return !isAarsloenTableCellEffectivelyEmpty(row.col0_dag) && !isAarsloenTableCellEffectivelyEmpty(row.col1_dag);
};

export const hasAtLeastOneValidRow = (rows: readonly AarsloenTableRow[], loenperiode: Loenperiode, satser: AarsloenSatserInput): boolean => {
  return rows.some((row) => {
    if (!hasCompletePeriodForLoenperiode(row, loenperiode)) return false;
    return calculateAarsloenRowDerived(row, satser).samlet !== 0;
  });
};

