import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { parseAmount, parsePercentToDecimal } from '../../utils/numberParsing';
import { roundByMethod } from '../../utils/rounding';

export type StandardLoenSatserInput = {
  feriePct?: string | number;
  fritvalgPct?: string | number;
  shSoPct?: string | number;
  storeBededagPct?: string | number;
  pensionPct?: string | number;
};

export type StandardLoenRowDerived = {
  ferieberet: number;
  fpFvShSo: number;
  pension: number;
  samlet: number;
};

export const roundStandardLoenAmountToTwoDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return roundByMethod(value, 2, 'halfAwayFromZero');
};

export const isStandardLoenTableCellEffectivelyEmpty = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  return value.trim() === '';
};

export const calculateStandardLoenRowDerived = (row: StandardLoenTableRow, satser: StandardLoenSatserInput): StandardLoenRowDerived => {
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

const EDITABLE_KEYS: Array<keyof StandardLoenTableRow> = [
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

export const isStandardLoenRowEffectivelyEmpty = (row: StandardLoenTableRow): boolean => {
  for (const key of EDITABLE_KEYS) {
    if (!isStandardLoenTableCellEffectivelyEmpty(row[key])) return false;
  }
  return true;
};

export const hasCompletePeriodForLoenperiode = (row: StandardLoenTableRow, loenperiode: Loenperiode): boolean => {
  if (loenperiode === 'maaned') return !isStandardLoenTableCellEffectivelyEmpty(row.col0_maaned) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_maaned);
  if (loenperiode === 'uge') return !isStandardLoenTableCellEffectivelyEmpty(row.col0_uge) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_uge);
  return !isStandardLoenTableCellEffectivelyEmpty(row.col0_dag) && !isStandardLoenTableCellEffectivelyEmpty(row.col1_dag);
};

export const hasAtLeastOneValidRow = (rows: readonly StandardLoenTableRow[], loenperiode: Loenperiode, satser: StandardLoenSatserInput): boolean => {
  return rows.some((row) => {
    if (!hasCompletePeriodForLoenperiode(row, loenperiode)) return false;
    return calculateStandardLoenRowDerived(row, satser).samlet !== 0;
  });
};
