import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { formatPercentFixed2 } from '../helpers/eoSharedUtils';
import { roundByMethod } from '../../../utils/rounding';

export type FormulaComponents = Readonly<{
  /**
   * Procentfelter angives som procentpoint, fx `12` for 12 % (ikke decimal 0,12).
   */
  baseValue: number;
  feriePct: number;
  fritvalgPct: number;
  shSoPct: number;
  pensionPct: number;
  storeBededagPct: number;
}>;

export type FormulaVisibility = Readonly<{
  showFritvalg: boolean;
  showShSo: boolean;
  showPension: boolean;
  showStoreBededag: boolean;
}>;

export const parsePercentInput = (raw: string | undefined): number => {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.replace('%', '').trim();
  if (trimmed === '') return 0;
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export const resolveFeriePctForFormula = (rowFeriepengeRaw: string | undefined, fallbackFeriePct: number | undefined): number => {
  const trimmed = rowFeriepengeRaw?.replace('%', '').trim() ?? '';
  if (trimmed !== '') return parsePercentInput(rowFeriepengeRaw);
  return typeof fallbackFeriePct === 'number' && Number.isFinite(fallbackFeriePct) ? fallbackFeriePct : 0;
};

export const formatPercentCellFromRaw = (raw: string | undefined): string => {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '' || trimmed === '-') return '-';
  const normalized = trimmed.replace('%', '').trim();
  const cleaned = normalized.replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return trimmed.includes('%') ? trimmed : `${trimmed} %`;
  return formatPercentFixed2(num);
};

export const mergeFeriepengeDisplay = (fromFeriePct: string | undefined, fromFeriepenge: string | undefined): string => {
  const normalize = (value: string | undefined): string | null => {
    const trimmed = value?.trim() ?? '';
    if (trimmed === '' || trimmed === '-') return null;
    return trimmed;
  };
  const parseComparablePercent = (value: string | null): number | null => {
    if (value === null) return null;
    const compact = value.replace('%', '').replace(/\s+/g, '');
    if (compact === '') return null;
    if (!/^-?[\d.,]+$/.test(compact)) return null;
    const normalized = compact.replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const left = normalize(fromFeriePct);
  const right = normalize(fromFeriepenge);

  if (!left && !right) return '-';
  if (left && !right) return left;
  if (!left && right) return right;
  const leftPercent = parseComparablePercent(left);
  const rightPercent = parseComparablePercent(right);
  if (leftPercent !== null && rightPercent !== null && Math.abs(leftPercent - rightPercent) <= 0.005) {
    return formatPercentFixed2(leftPercent);
  }
  if (left === right) return left ?? '-';
  return `${left} / ${right}`;
};

export const wrapIndexFormulaAfterSlashWhenLong = (value: string, maxInlineLength = 90): string => {
  if (value.includes('\n')) return value;
  if (value.length <= maxInlineLength) return value;
  const parts = value.split(' / ');
  if (parts.length !== 2) return value;
  return `${parts[0]} /\n${parts[1]}`;
};

export const formatOverenskomstPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const pct = roundByMethod(value * 100, 2, 'halfAwayFromZero');
  return formatPercentFixed2(pct);
};

export const computeFormulaValue = (components: FormulaComponents): number => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;
  const tillaegPct = feriePct + fritvalgPct + shSoPct + storeBededagPct;
  return baseValue * (1 + tillaegPct / 100) * (1 + pensionPct / 100);
};

export const formatOverenskomstAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return formatCurrency(value);
};

export const buildFormulaText = (components: FormulaComponents, visibility: FormulaVisibility): string => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;

  const baseStr = formatCurrency(baseValue);
  const extraParts = [
    ...(feriePct !== 0 ? [formatPercent(feriePct)] : []),
    ...(visibility.showFritvalg && fritvalgPct !== 0 ? [formatPercent(fritvalgPct)] : []),
    ...(visibility.showShSo && shSoPct !== 0 ? [formatPercent(shSoPct)] : []),
    ...(visibility.showStoreBededag && storeBededagPct !== 0 ? [formatPercentFixed2(storeBededagPct)] : []),
  ];
  const factors: string[] = [];
  if (extraParts.length > 0) {
    factors.push(`(${[formatPercent(100), ...extraParts].join(' + ')})`);
  }
  if (visibility.showPension && pensionPct !== 0) {
    factors.push(`(${[formatPercent(100), formatPercent(pensionPct)].join(' + ')})`);
  }
  if (factors.length === 0) return baseStr;
  return `${baseStr} x ${factors.join(' x ')}`;
};
