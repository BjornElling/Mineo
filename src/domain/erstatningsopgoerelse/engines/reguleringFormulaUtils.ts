import { formatCurrency, formatPercent } from '../../../utils/formatUtils';
import { parsePercentPointString } from '../../../utils/numberParsing';
import { roundByMethod } from '../../../utils/rounding';
import { isWithinTolerance } from '../../../utils/numberComparison';
import {
  formatPercentFixed2,
} from '../helpers/eoSharedUtils';

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

/**
 * Kanonisk afrundings-politik for en reguleringsforms `deltaPct`: 2 decimaler, halfAwayFromZero
 * (regulering-redesign R8, mekanisme 1). Alle reguleringsformer (statistik inkl. ASL-krydsningen,
 * KRL, manuel, manuel procentsats, overenskomst offentlig/privat) OG motorens re-runding afrunder
 * deltaPct efter præcis denne politik, så det viste reguleringsindeks kan efterregnes af beløbet.
 *
 * Samlet ét sted som en NAVNGIVEN politik frem for spredte magiske `roundByMethod(x, 2, ...)`-kald,
 * så decimalantallet ikke kan drive til en forkert konvention ved en fremtidig ændring. (KL-lønaftaler
 * afviger bevidst: dens deltaPct afledes af den trinvist afrundede kædeløn i fuld præcision – den
 * bruger IKKE denne politik. TAF-opreguleret bruger 4 decimaler, en separat, bevidst kontekst.)
 */
export const roundReguleringDeltaPct = (deltaPct: number): number =>
  roundByMethod(deltaPct, 2, 'halfAwayFromZero');

export const parsePercentInput = (raw: string | number | undefined): number => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  return parsePercentPointString(raw) ?? 0;
};

export const resolveFeriePctForFormula = (rowFeriepengeRaw: string | number | undefined, fallbackFeriePct: number | undefined): number => {
  if (typeof rowFeriepengeRaw === 'number') return Number.isFinite(rowFeriepengeRaw) ? rowFeriepengeRaw : 0;
  const trimmed = rowFeriepengeRaw?.replace('%', '').trim() ?? '';
  if (trimmed !== '') return parsePercentInput(rowFeriepengeRaw);
  return typeof fallbackFeriePct === 'number' && Number.isFinite(fallbackFeriePct) ? fallbackFeriePct : 0;
};

export const formatPercentCellFromRaw = (raw: string | number | undefined): string => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? formatPercentFixed2(raw) : '-';
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '' || trimmed === '-') return '-';
  const num = parsePercentPointString(trimmed);
  if (num === undefined) return trimmed.includes('%') ? trimmed : `${trimmed} %`;
  return formatPercentFixed2(num);
};

export const mergeFeriepengeDisplay = (fromFeriePct: string | number | undefined, fromFeriepenge: string | number | undefined): string => {
  const normalize = (value: string | number | undefined): string | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? formatPercentFixed2(value) : null;
    const trimmed = value?.trim() ?? '';
    if (trimmed === '' || trimmed === '-') return null;
    return trimmed;
  };
  const left = normalize(fromFeriePct);
  const right = normalize(fromFeriepenge);

  if (!left && !right) return '-';
  if (left && !right) return left;
  if (!left && right) return right;
  const leftPercent = left === null ? undefined : parsePercentPointString(left);
  const rightPercent = right === null ? undefined : parsePercentPointString(right);
  if (leftPercent !== undefined && rightPercent !== undefined && isWithinTolerance(leftPercent, rightPercent, 0.005)) {
    return formatPercentFixed2(leftPercent);
  }
  if (left === right) return left ?? '-';
  return `${left} / ${right}`;
};

export const wrapIndexFormulaAfterSlashWhenLong = (
  value: string,
  maxInlineLength = 90,
  shouldWrapAfterSlash = true
): string => {
  if (!shouldWrapAfterSlash) return value;
  if (value.includes('\n')) return value;
  if (value.length <= maxInlineLength) return value;
  const parts = value.split(' / ');
  if (parts.length !== 2) return value;
  return `${parts[0]} /\n${parts[1]}`;
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

/**
 * Beregner samlet lønpakkeværdi (grundløn × tillægsfaktorer) for reguleringsindeks.
 *
 * Tynd adapter over den kanoniske `computeFormulaValue`: mapper domænenavnet
 * `grundloen` → `baseValue` og deler dermed præcis samme matematik og finite-semantik
 * som privat overenskomst-grenen (der kalder `computeFormulaValue` direkte). Tidligere var
 * dette en parallel kopi af samme formel – konsolideret så der kun er ét sted for
 * lønpakke-formlen (jf. reguleringsreview U5). Bor sammen med `computeFormulaValue`, så
 * de to indgange til samme formel ikke igen driver fra hinanden (regulering-redesign R7).
 *
 * Procent-konvention: alle procentsatser angives som hele pct-tal (fx `17.3` for 17,3 %).
 * Callsites gater resultatet (`!Number.isFinite || <= 0` → throw), så en ugyldig pakkeværdi
 * fail-closer synligt frem for at drive en forkert regulering.
 */
export const computePackageValuePct = (args: {
  grundloen: number;
  feriePct: number;
  shSoPct: number;
  fritvalgPct: number;
  pensionPct: number;
  storeBededagPct: number;
}): number =>
  computeFormulaValue({
    baseValue: args.grundloen,
    feriePct: args.feriePct,
    fritvalgPct: args.fritvalgPct,
    shSoPct: args.shSoPct,
    pensionPct: args.pensionPct,
    storeBededagPct: args.storeBededagPct,
  });

export const buildFormulaText = (components: FormulaComponents, visibility: FormulaVisibility): string => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;

  const baseStr = formatCurrency(baseValue);
  // Rækkefølgen af tillægsprocenterne skal følge kolonnerækkefølgen i Reguleringsværdier-tabellen
  // (Feriepenge, SH/SO, Fritvalg, Store Bededag), så indeksformlen kan aflæses direkte mod tabellen.
  // Summen er kommutativ, så rækkefølgen påvirker kun den viste tekst, ikke det beregnede indeks.
  const extraParts = [
    ...(feriePct !== 0 ? [formatPercent(feriePct)] : []),
    ...(visibility.showShSo && shSoPct !== 0 ? [formatPercent(shSoPct)] : []),
    ...(visibility.showFritvalg && fritvalgPct !== 0 ? [formatPercent(fritvalgPct)] : []),
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
