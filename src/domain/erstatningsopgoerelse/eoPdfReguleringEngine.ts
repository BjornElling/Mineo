import type { ISODateString } from '../../types/branded';
import { isoToDanish, parseISODate, subtractOneDay } from '../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { LoenudviklingSegment } from './eoPdfModelTypes';
import { getAngivetLoenOpreguleresFraDato } from './angivetLoenHelpers';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from './tafBeregningsenhed';
import { clampTafRow, resolveTafConstraintBounds } from './tafPeriodConstraints';
import {
  convertAnciennitetSats,
  detectDecimalPlaces,
  formatAmountWithoutTrailingDecimals,
  hasAnyPctSourceOrInput,
  hasPctSourceOrInput,
  numOrZero,
  parseDanishToIso as parseDanishToIsoShared,
  parseOptionalIsoDate as parseOptionalIsoDateShared,
  resolveOffentligLoenEkstraGrundloen,
  resolvePctPointFromSatsOrInput,
  resolveReguleringsdato as resolveReguleringsdatoShared,
  isAslStatistikModel,
  resolveStatistikModelId,
} from './sharedPdfUtils';
import { round2 as roundToTwoDecimals } from '../../utils/roundingShortcuts';
import { maxISO, minISO } from '../../utils/isoDateHelpers';
import { amountValueToDisplayString, amountValueToNumber } from '../../utils/expressionAmount';
import { formatAsAmount, formatCurrency, formatPercent as formatPercentUtil } from '../../utils/formatUtils';
import { formatIsoDateShort, formatIsoDateLong } from '../../utils/dateFormatting';
import { parseAmount } from '../../utils/numberParsing';
import { roundByMethod } from '../../utils/rounding';
import { aarsloenAslMax } from '../../data/lovbestemteRates';
import {
  assertOffentligReguleringsDatoGyldig,
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligOverenskomstTypeById,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getOverenskomst,
  resolveOverenskomstRef,
} from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import { getKRLSatstabel, isKRLSatstabelId } from '../../data/KRLrates';
import { getStatistiskLoenudvikling } from '../../data/statistiskeRates';
import { STORE_BEDEDAG_PCT } from '../../config/regulatoryRates';
import { STORE_BEDEDAG_START } from '../../config/dateRanges';
import {
  buildFormulaText,
  computeFormulaValue,
  formatOverenskomstAmount,
  formatOverenskomstPercent,
  formatPercentCellFromRaw,
  mergeFeriepengeDisplay,
  parsePercentInput,
  resolveFeriePctForFormula,
  type FormulaComponents,
  type FormulaVisibility,
  wrapIndexFormulaAfterSlashWhenLong,
} from './reguleringFormulaUtils';
import { resolveOverenskomstEffectiveStartIso } from './reguleringCoverage';

export type ReguleringIndexRow = Readonly<{
  fraDato: string;
  tilDato: string;
  indeksberegning: string;
  indeks: string;
  loenudvikling: string;
}>;

export type ReguleringValuesTableData = Readonly<{
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

type IndexRowWithIso = ReguleringIndexRow & Readonly<{
  fraIso: ISODateString;
  tilIso: ISODateString;
  signature: string;
}>;

const parseOptionalIsoDate = parseOptionalIsoDateShared;
const parseDanishToISO = parseDanishToIsoShared;
export const resolveStatistikModelIdFromLabel = resolveStatistikModelId;
const formatDateShort = formatIsoDateShort;
const formatDateLong = formatIsoDateLong;

const isLoengruppe = (value: number): value is Loengruppe =>
  Number.isInteger(value) && value >= 0 && value <= 4;

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
};

const isZeroPct = (value: number | undefined): boolean => Math.abs(value ?? 0) < 0.000001;

const parseIsoDateToUtcDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  return parseISODate(iso) ?? null;
};

const resolveReguleringTableStartIso = (
  reguleringsdato: ISODateString | undefined,
  tafFra: ISODateString
): ISODateString => {
  if (!reguleringsdato) return tafFra;
  return reguleringsdato < tafFra ? reguleringsdato : tafFra;
};

export const resolveTafDateBounds = (
  eoValues: ErstatningsopgoerelseValues
): Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null => {
  const tafBounds = resolveTafConstraintBounds(eoValues);

  let foerste: ISODateString | undefined;
  let sidste: ISODateString | undefined;

  for (const row of eoValues.tafPerioder ?? []) {
    const clamped = clampTafRow(row, tafBounds);
    if (!clamped) continue;
    foerste = foerste ? minISO(foerste, clamped.fra) : clamped.fra;
    sidste = sidste ? maxISO(sidste, clamped.til) : clamped.til;
  }

  if (!foerste || !sidste) return null;
  return { foerste, sidste };
};

export const resolveReguleringsdato = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | undefined => resolveReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
  skadesdato: stamdataValues.skadesdato,
});

export const resolveLoenSkadesdatoText = (params: {
  subject: 'lønnen';
  skadesdato: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
}): string => {
  const { subject, skadesdato, saerligFraDatoRegulering } = params;
  if (saerligFraDatoRegulering && skadesdato && saerligFraDatoRegulering !== skadesdato) {
    const formatted = formatDateLong(saerligFraDatoRegulering);
    if (formatted) {
      return `${subject} opgjort per ${formatted}`;
    }
  }
  return `${subject} på skadesdatoen`;
};


const percentFromDecimal = (value: number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return roundByMethod(value * 100, 2, 'halfAwayFromZero');
};

const formatIndexValue = (value: number): string =>
  formatAsAmount(value, 2);

const formatLoenudviklingFromIndex = (indexValue: number): string => {
  if (!Number.isFinite(indexValue)) return '';
  const delta = roundByMethod(indexValue - 100, 2, 'halfAwayFromZero');
  if (Math.abs(delta) < 0.000001) return '';
  const absDisplay = formatAsAmount(Math.abs(delta), 2);
  return delta > 0 ? `+ ${absDisplay} %` : `- ${absDisplay} %`;
};

type ReguleringsPeriode = Readonly<{
  startIso: ISODateString;
  components: FormulaComponents;
  visibility: FormulaVisibility;
}>;

const findPeriodForDate = (
  periods: readonly ReguleringsPeriode[],
  iso: ISODateString
): ReguleringsPeriode | undefined => {
  let candidate: ReguleringsPeriode | undefined;
  for (const period of periods) {
    if (period.startIso > iso) break;
    candidate = period;
  }
  return candidate;
};

const buildIndexFormulaDisplay = (
  numeratorDisplay: string,
  denominatorDisplay: string,
  numeratorValue: number,
  denominatorValue: number,
  isStatistik: boolean
): string => {
  const isPlainValue = isStatistik || (!numeratorDisplay.includes(' x ') && !denominatorDisplay.includes(' x '));
  const isSameNumericValue = Math.abs(numeratorValue - denominatorValue) < 1e-9;
  if (isSameNumericValue) {
    return numeratorDisplay;
  }
  const formula = isPlainValue
    ? `(${numeratorDisplay} / ${denominatorDisplay})`
    : `(${numeratorDisplay}) /\n(${denominatorDisplay})`;
  return wrapIndexFormulaAfterSlashWhenLong(formula);
};

const resolveReguleringsvaerdierLoenHeader = (
  tafBeregningsenhed: TafBeregningsenhed
): 'Timeløn' | 'Månedsløn' =>
  tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? 'Timeløn' : 'Månedsløn';

const REGULERINGSVAERDIER_FRA_DATO_HEADER = 'Fra-dato';
const REGULERINGSVAERDIER_PENSION_HEADER = 'AG pens. bidrag';

const mergeConsecutiveValueRows = (rows: readonly string[][]): readonly string[][] => {
  if (rows.length <= 1) return rows;
  const merged: string[][] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    const hasSameValues = Boolean(
      last &&
      last.length === row.length &&
      last.slice(1).every((cell, index) => cell === row[index + 1])
    );
    if (!hasSameValues) {
      merged.push(row);
    }
  }
  return merged;
};

const mergeConsecutiveRowsWithSameCalculation = (rows: readonly IndexRowWithIso[]): readonly ReguleringIndexRow[] => {
  if (rows.length <= 1) return rows;
  const merged: IndexRowWithIso[] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    const isAdjacent = Boolean(last && subtractOneDay(row.fraIso) === last.tilIso);
    const hasSameCalculation = Boolean(last && last.signature === row.signature);
    if (last && isAdjacent && hasSameCalculation) {
      const updated: IndexRowWithIso = {
        ...last,
        tilIso: row.tilIso,
        tilDato: formatDateShort(row.tilIso),
      };
      merged[merged.length - 1] = updated;
    } else {
      merged.push(row);
    }
  }
  return merged;
};

export const buildReguleringsvaerdierTableData = (params: Readonly<{
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  reguleringsdato: ISODateString | undefined;
  tafFra: ISODateString;
  tafTil: ISODateString;
  tafBeregningsenhed: TafBeregningsenhed;
}>): ReguleringValuesTableData | null => {
  const { ansaettelsesforhold, reguleringsdato, tafFra, tafTil, tafBeregningsenhed } = params;
  // Bevidst forskel: Reguleringsværdier-tabellen må starte tidligere end TAF ved tidlig reguleringsdato.
  const reguleringTableStartIso = resolveReguleringTableStartIso(reguleringsdato, tafFra);
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;

  if (grundlag === 'Overenskomst') {
    const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
    if (!overenskomstId) return null;
    const overenskomstTableStartIso = resolveOverenskomstEffectiveStartIso(overenskomstId, reguleringTableStartIso);
    const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
    if (offentligType) {
      const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
      if (!loenType) return null;
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      if (typeof trinValue !== 'number' || typeof gruppeValue !== 'number') return null;
      if (!isLoengruppe(gruppeValue)) return null;
      let loentrin: ReturnType<typeof toLoentrin>;
      try {
        loentrin = toLoentrin(trinValue);
      } catch {
        return null;
      }

      const fraDato = isoToDanish(overenskomstTableStartIso);
      const tilDato = isoToDanish(tafTil);
      if (!fraDato || !tilDato) return null;
      assertOffentligReguleringsDatoGyldig(fraDato);
      const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';

      const baseResult = getOffentligLoenForDato(offentligType, fraDato, loentrin, gruppeValue);
      if (!baseResult) return null;

      const satser = getOffentligLoenForPeriode(offentligType, fraDato, tilDato, loentrin, gruppeValue);
      const tillaegsSatser = getOffentligTillaegsSatserForPeriode(
        overenskomstId,
        fraDato,
        tilDato,
        applyAlmindeligLoenPaaShDageRegel
      );
      const hasShSo =
        hasAnyPctSourceOrInput(tillaegsSatser, (sats) => sats.shSoSats, ansaettelsesforhold.shSoPct);
      const hasFritvalg =
        hasAnyPctSourceOrInput(tillaegsSatser, (sats) => sats.fritvalg, ansaettelsesforhold.fritvalgPct);
      const hasAgPension =
        hasAnyPctSourceOrInput(tillaegsSatser, (sats) => sats.agPension, ansaettelsesforhold.pensionPct);
      const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
      const loenHeader = resolveReguleringsvaerdierLoenHeader(tafBeregningsenhed);
      const columns = [
        REGULERINGSVAERDIER_FRA_DATO_HEADER,
        loenHeader,
        ...(showFeriePctColumn ? ['Feriepenge'] : []),
        ...(hasShSo ? ['SH/SO'] : []),
        ...(hasFritvalg ? ['Fritvalg'] : []),
        ...(hasAgPension ? [REGULERINGSVAERDIER_PENSION_HEADER] : []),
      ];

      const rows: string[][] = [];
      const ekstraGrundloenInput = numOrZero(amountValueToNumber(ansaettelsesforhold.offentligLoenEkstraGrundloen));
      const ekstraMaanedsLoen =
        ekstraGrundloenInput > 0
            ? (loenType === 'maanedsLoen'
            ? ekstraGrundloenInput
            : resolveOffentligLoenEkstraGrundloen(ekstraGrundloenInput, 'Time', 'Måned'))
          : 0;
      const ekstraTimeLoen =
        ekstraGrundloenInput > 0
          ? (loenType === 'timeLoen'
            ? ekstraGrundloenInput
            : resolveOffentligLoenEkstraGrundloen(ekstraGrundloenInput, 'Måned', 'Time'))
          : 0;
      const anciennitetDatoIso = parseOptionalIsoDate(ansaettelsesforhold.anciennitetstillaegDato);
      const anciennitetSatsValue = ansaettelsesforhold.anciennitetstillaegSats?.value;
      const anciennitetInputPer = ansaettelsesforhold.anciennitetstillaegSatsAngivesPer;
      const harAnciennitetstillaeg = Boolean(
        ansaettelsesforhold.harAnciennitetstillaegEfterSkadesdatoen &&
        anciennitetDatoIso &&
        anciennitetInputPer &&
        typeof anciennitetSatsValue === 'number' &&
        Number.isFinite(anciennitetSatsValue) &&
        anciennitetSatsValue > 0
      );
      const anciennitetMaanedsLoen = harAnciennitetstillaeg
        ? roundToTwoDecimals(convertAnciennitetSats(anciennitetSatsValue!, anciennitetInputPer!, 'Måned'))
        : 0;
      const anciennitetTimeLoen = harAnciennitetstillaeg
        ? roundToTwoDecimals(convertAnciennitetSats(anciennitetSatsValue!, anciennitetInputPer!, 'Time'))
        : 0;
      const addRow = (
        labelIso: ISODateString,
        maanedsLoen: number,
        timeLoen: number
      ) => {
        const labelDato = isoToDanish(labelIso);
        const tillaegSats = labelDato
          ? getOffentligTillaegsSatserForDato(
              overenskomstId,
              labelDato,
              applyAlmindeligLoenPaaShDageRegel
            )
          : undefined;
        const anciennitetAktiv = Boolean(harAnciennitetstillaeg && anciennitetDatoIso && labelIso >= anciennitetDatoIso);
        const samletMaanedsTillaeg = ekstraMaanedsLoen + (anciennitetAktiv ? anciennitetMaanedsLoen : 0);
        const samletTimeTillaeg = ekstraTimeLoen + (anciennitetAktiv ? anciennitetTimeLoen : 0);
        const maanedsLoenDisplay =
          samletMaanedsTillaeg > 0
            ? `${formatCurrency(maanedsLoen)} (+ ${formatAmountWithoutTrailingDecimals(samletMaanedsTillaeg)} kr.)`
            : formatCurrency(maanedsLoen);
        const timeLoenDisplay =
          samletTimeTillaeg > 0
            ? `${formatCurrency(timeLoen)} (+ ${formatAmountWithoutTrailingDecimals(samletTimeTillaeg)} kr.)`
            : formatCurrency(timeLoen);
        rows.push([
          labelDato ?? labelIso,
          loenHeader === 'Månedsløn' ? maanedsLoenDisplay : timeLoenDisplay,
          ...(showFeriePctColumn ? [formatPctFromInput(ansaettelsesforhold.feriePct)] : []),
          ...(hasShSo ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.shSoSats, ansaettelsesforhold.shSoPct))] : []),
          ...(hasFritvalg ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.fritvalg, ansaettelsesforhold.fritvalgPct))] : []),
          ...(hasAgPension ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.agPension, ansaettelsesforhold.pensionPct))] : []),
        ]);
      };

      addRow(overenskomstTableStartIso, baseResult.maanedsLoen, baseResult.timeLoen);

      const rowDates = new Set<ISODateString>();
      for (const entry of satser) {
        const iso = parseDanishToISO(entry.effectiveDate);
        if (!iso) continue;
        if (iso > overenskomstTableStartIso && iso <= tafTil) rowDates.add(iso);
      }
      for (const entry of tillaegsSatser) {
        const iso = parseDanishToISO(entry.fraDato);
        if (!iso) continue;
        if (iso > overenskomstTableStartIso && iso <= tafTil) rowDates.add(iso);
      }
      if (
        applyAlmindeligLoenPaaShDageRegel &&
        overenskomstTableStartIso < STORE_BEDEDAG_START &&
        tafTil >= STORE_BEDEDAG_START
      ) {
        rowDates.add(STORE_BEDEDAG_START);
      }
      if (harAnciennitetstillaeg && anciennitetDatoIso && anciennitetDatoIso > overenskomstTableStartIso && anciennitetDatoIso <= tafTil) {
        rowDates.add(anciennitetDatoIso);
      }

      const sortedDates = Array.from(rowDates).sort((a, b) => (a < b ? -1 : 1));
      for (const iso of sortedDates) {
        const danish = isoToDanish(iso);
        if (!danish) continue;
        const loen = getOffentligLoenForDato(offentligType, danish, loentrin, gruppeValue);
        if (!loen) continue;
        addRow(iso, loen.maanedsLoen, loen.timeLoen);
      }

      return { columns, rows: mergeConsecutiveValueRows(rows) };
    }

    const ref = resolveOverenskomstRef(overenskomstId);
    if (!ref) return null;
    const fraDato = isoToDanish(overenskomstTableStartIso);
    const tilDato = isoToDanish(tafTil);
    if (!fraDato || !tilDato) return null;

    const satser = getEffektiveSatserForPeriode({
      overenskomstId: ref.baseId,
      fraDato,
      tilDato,
      applyAlmindeligLoenPaaShDageRegel: ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn',
    });
    const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;
    const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null);
    const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
    const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
    const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
    const hasSfgg = allSatser.some((sats) => sats.sfgg !== null);
    const hasSfggFaglKbh = allSatser.some((sats) => sats.sfggFaglKbh !== null);
    const hasSfggFaglProv = allSatser.some((sats) => sats.sfggFaglProv !== null);
    const hasSfggUfaglKbh = allSatser.some((sats) => sats.sfggUfaglKbh !== null);
    const hasSfggUfaglProv = allSatser.some((sats) => sats.sfggUfaglProv !== null);
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
    const loenHeader = resolveReguleringsvaerdierLoenHeader(tafBeregningsenhed);
    const columns = [
      REGULERINGSVAERDIER_FRA_DATO_HEADER,
      ...(hasGrundloen ? [loenHeader] : []),
      ...(hasGrundloen && showFeriePctColumn ? ['Feriepenge'] : []),
      ...(hasShSo ? ['SH/SO'] : []),
      ...(hasFritvalg ? ['Fritvalg'] : []),
      ...(hasAgPension ? [REGULERINGSVAERDIER_PENSION_HEADER] : []),
      ...(hasSfgg ? ['SFGG'] : []),
      ...(hasSfggFaglKbh ? ['SFGG\nfagl. Kbh'] : []),
      ...(hasSfggFaglProv ? ['SFGG\nfagl. prov'] : []),
      ...(hasSfggUfaglKbh ? ['SFGG\nufagl. Kbh'] : []),
      ...(hasSfggUfaglProv ? ['SFGG\nufagl. prov'] : []),
    ] as const;
    const rowDates = new Set<ISODateString>([overenskomstTableStartIso]);
    for (const sats of satser) {
      const iso = parseDanishToISO(sats.fraDato);
      if (!iso) continue;
      if (iso > overenskomstTableStartIso && iso <= tafTil) rowDates.add(iso);
    }
    if (
      ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn' &&
      overenskomstTableStartIso < STORE_BEDEDAG_START &&
      tafTil >= STORE_BEDEDAG_START
    ) {
      rowDates.add(STORE_BEDEDAG_START);
    }

    const rows = Array.from(rowDates)
      .sort((a, b) => (a < b ? -1 : 1))
      .map((iso) => {
        const danish = isoToDanish(iso);
        if (!danish) return null;
        const sats = getEffektiveSatserForDato({
          overenskomstId: ref.baseId,
          dato: danish,
          applyAlmindeligLoenPaaShDageRegel: ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn',
        });
        if (!sats) return null;
        const row: string[] = [danish];
      if (hasGrundloen) row.push(formatOverenskomstAmount(sats.grundloen));
      if (hasGrundloen && showFeriePctColumn) row.push(mergeFeriepengeDisplay(feriePctDisplay, undefined));
      if (hasShSo) row.push(formatOverenskomstPercent(sats.shSoSats));
      if (hasFritvalg) row.push(formatOverenskomstPercent(sats.fritvalg));
      if (hasAgPension) row.push(formatOverenskomstPercent(sats.agPension));
      if (hasSfgg) row.push(formatOverenskomstAmount(sats.sfgg));
      if (hasSfggFaglKbh) row.push(formatOverenskomstAmount(sats.sfggFaglKbh));
      if (hasSfggFaglProv) row.push(formatOverenskomstAmount(sats.sfggFaglProv));
      if (hasSfggUfaglKbh) row.push(formatOverenskomstAmount(sats.sfggUfaglKbh));
      if (hasSfggUfaglProv) row.push(formatOverenskomstAmount(sats.sfggUfaglProv));
      return row;
      })
      .filter((row): row is string[] => Boolean(row));
    return { columns, rows: mergeConsecutiveValueRows(rows) };
  }

  if (grundlag === 'Manuelt angivet') {
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
    const applyStoreBededagRegulering =
      ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn' &&
      reguleringTableStartIso < STORE_BEDEDAG_START &&
      tafTil >= STORE_BEDEDAG_START;
    const manualRows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];
    const normalizedRows = manualRows
      .map((row, index) => {
        const iso = index === 0 ? reguleringTableStartIso : parseDanishToISO(row.dato);
        if (!iso || iso < reguleringTableStartIso || iso > tafTil) return null;
        return { iso, row };
      })
      .filter((row): row is Readonly<{ iso: ISODateString; row: NonNullable<typeof manualRows>[number] }> => Boolean(row))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1));

    if (applyStoreBededagRegulering && !normalizedRows.some((entry) => entry.iso === STORE_BEDEDAG_START)) {
      const baseForStore = [...normalizedRows]
        .filter((entry) => entry.iso <= STORE_BEDEDAG_START)
        .sort((a, b) => (a.iso < b.iso ? 1 : -1))[0];
      if (baseForStore) {
        normalizedRows.push({ iso: STORE_BEDEDAG_START, row: baseForStore.row });
        normalizedRows.sort((a, b) => (a.iso < b.iso ? -1 : 1));
      }
    }

    const rows = normalizedRows.map(({ iso, row }) => {
      const cells: string[] = [
        formatDateShort(iso),
        amountValueToDisplayString(row.grundloen, 2) || '-',
      ];
      cells.push(
        mergeFeriepengeDisplay(showFeriePctColumn ? feriePctDisplay : undefined, formatPercentCellFromRaw(row.feriepenge)),
        formatPercentCellFromRaw(row.shSoSats),
        formatPercentCellFromRaw(row.fritvalg),
        ...(applyStoreBededagRegulering ? [iso >= STORE_BEDEDAG_START ? formatPctFromInput(STORE_BEDEDAG_PCT) : formatPctFromInput(0)] : []),
        formatPercentCellFromRaw(row.agPension)
      );
      return cells;
    });
    return {
      columns: [
        REGULERINGSVAERDIER_FRA_DATO_HEADER,
        resolveReguleringsvaerdierLoenHeader(tafBeregningsenhed),
        'Feriepenge',
        'SH/SO',
        'Fritvalg',
        ...(applyStoreBededagRegulering ? ['Store Bededag'] : []),
        REGULERINGSVAERDIER_PENSION_HEADER,
      ],
      rows: mergeConsecutiveValueRows(rows),
    };
  }

  if (grundlag === 'Statistik') {
    const modelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
    if (modelLabel === '') return null;

    if (isAslStatistikModel(modelLabel)) {
      const regDate = parseIsoDateToUtcDate(reguleringsdato);
      const tafFraDate = parseIsoDateToUtcDate(reguleringTableStartIso);
      const tafTilDate = parseIsoDateToUtcDate(tafTil);
      if (!regDate || !tafFraDate || !tafTilDate) return null;
      const regYear = regDate.getUTCFullYear();
      const startYear = tafFraDate.getUTCFullYear();
      const endYear = tafTilDate.getUTCFullYear();
      const rows: string[][] = [];
      const regValue = aarsloenAslMax[regYear as keyof typeof aarsloenAslMax];
      if (typeof regValue === 'number') rows.push([String(regYear), formatCurrency(regValue)]);
      for (let year = startYear; year <= endYear; year += 1) {
        if (year === regYear) continue;
        const value = aarsloenAslMax[year as keyof typeof aarsloenAslMax];
        if (typeof value !== 'number') continue;
        rows.push([String(year), formatCurrency(value)]);
      }
      return { columns: ['År', 'Maksimum årsløn'], rows };
    }

    const modelId = resolveStatistikModelIdFromLabel(modelLabel);
    if (!modelId) return null;
    const model = getStatistiskLoenudvikling(modelId);
    if (!model) return null;

    const periodStarts = model.indeksvaerdier
      .flatMap((value) => {
        const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
        if (!match) return [];
        const year = Number(match[1]);
        const quarter = Number(match[2]);
        if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
        const month = (quarter - 1) * 3 + 1;
        const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
        if (!startIso) return [];
        return [{ kvartal: value.kvartal, startIso, indeksvaerdi: value.indeksvaerdi }];
      })
      .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
    if (periodStarts.length === 0) return null;

    const decimals = detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeksvaerdi));
    const formatIndex = (value: number) =>
      formatAsAmount(value, decimals);

    let basePeriod = periodStarts[0];
    for (const period of periodStarts) {
      if (period.startIso > reguleringTableStartIso) break;
      basePeriod = period;
    }

    const rows: string[][] = [[basePeriod.kvartal, formatDateShort(reguleringTableStartIso), formatIndex(basePeriod.indeksvaerdi)]];
    for (const period of periodStarts) {
      if (period.startIso <= reguleringTableStartIso) continue;
      if (period.startIso > tafTil) continue;
      rows.push([period.kvartal, formatDateShort(period.startIso), formatIndex(period.indeksvaerdi)]);
    }
    return { columns: ['Kvartal', 'Startdato', 'Indeksværdi'], rows };
  }

  if (grundlag === 'KRL satstabel') {
    const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
    if (!krlId || !isKRLSatstabelId(krlId)) return null;
    const tabel = getKRLSatstabel(krlId);
    if (!tabel || tabel.vaerdier.length === 0) return null;

    const formatKrlPct = (value: number): string =>
      formatAsAmount(value, 4) + ' %';

    const periodStarts = tabel.vaerdier
      .map((v) => {
        const startIso = parseDanishToISO(v.fraDato);
        if (!startIso) return null;
        return { startIso, fraDato: v.fraDato, reguleringsPct: v.reguleringsPct };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
    if (periodStarts.length === 0) return null;

    // Find basisperiode
    let basePeriod = periodStarts[0];
    for (const period of periodStarts) {
      if (period.startIso > reguleringTableStartIso) break;
      basePeriod = period;
    }

    const rows: string[][] = [[basePeriod.fraDato, formatKrlPct(basePeriod.reguleringsPct)]];
    for (const period of periodStarts) {
      if (period.startIso <= reguleringTableStartIso) continue;
      if (period.startIso > tafTil) continue;
      rows.push([period.fraDato, formatKrlPct(period.reguleringsPct)]);
    }
    return { columns: ['Fra-dato', 'Reguleringsprocent'], rows };
  }

  return null;
};

export const buildReguleringIndexRows = (params: Readonly<{
  segments: readonly LoenudviklingSegment[];
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  reguleringsdato: ISODateString | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
}>): readonly ReguleringIndexRow[] => {
  const { segments, ansaettelsesforhold, reguleringsdato, tafBeregningsenhed } = params;
  if (segments.length === 0) return [];
  const tafStartIso = segments[0].fra;
  const tafEndIso = segments[segments.length - 1].til;
  const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
  const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
  const getStoreBededagPct = (iso: ISODateString): number =>
    applyAlmindeligLoenPaaShDageRegel && iso >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
  const statistikModelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
  const isStatistik = loenudviklingBasis === 'Statistik';
  const isKRL = loenudviklingBasis === 'KRL satstabel';
  const isSimpleIndex = isStatistik || isKRL;
  const isAslModel = isStatistik && isAslStatistikModel(statistikModelLabel);
  const statDecimalPlaces = (() => {
    if (isKRL) return 4;
    if (!isStatistik || isAslModel) return 2;
    const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
    if (!modelId) return 2;
    const model = getStatistiskLoenudvikling(modelId);
    if (!model) return 2;
    return detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeksvaerdi));
  })();
  const formatStatValue = isAslModel
    ? formatCurrency
    : (value: number) =>
      formatAsAmount(value, statDecimalPlaces);

  const splitSegmentsAtBoundary = (
    inputSegments: readonly LoenudviklingSegment[],
    boundaryIso: ISODateString
  ): readonly LoenudviklingSegment[] => {
    const result: LoenudviklingSegment[] = [];
    for (const segment of inputSegments) {
      if (!(segment.fra < boundaryIso && segment.til >= boundaryIso)) {
        result.push(segment);
        continue;
      }
      const leftTil = subtractOneDay(boundaryIso);
      if (leftTil && segment.fra <= leftTil) {
        result.push({ ...segment, til: leftTil });
      }
      if (boundaryIso <= segment.til) {
        result.push({ ...segment, fra: boundaryIso });
      }
    }
    return result;
  };

  const anciennitetForIndex = (() => {
    if (loenudviklingBasis !== 'Overenskomst') return null;
    if (!ansaettelsesforhold.overenskomstId || !ansaettelsesforhold.harAnciennitetstillaegEfterSkadesdatoen) return null;
    const anciennitetDato = ansaettelsesforhold.anciennitetstillaegDato;
    const satsValue = ansaettelsesforhold.anciennitetstillaegSats?.value;
    if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
      return null;
    }
    const tafBeregnesSom = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(ansaettelsesforhold.overenskomstId, tafBeregnesSom);
    if (!grundloenAngivetPer) return null;
    if (anciennitetDato > tafEndIso) return null;
    const inputPer = ansaettelsesforhold.anciennitetstillaegSatsAngivesPer;
    const supplementValue = convertAnciennitetSats(satsValue, inputPer, grundloenAngivetPer);
    const roundedSupplement = roundToTwoDecimals(supplementValue);
    if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
    return {
      activeFromIso: anciennitetDato,
      segmentBoundaryIso: anciennitetDato < tafStartIso ? tafStartIso : anciennitetDato,
      supplementValue: roundedSupplement,
    };
  })();

  const segmentsForCalc = anciennitetForIndex && anciennitetForIndex.segmentBoundaryIso > tafStartIso
    ? splitSegmentsAtBoundary(segments, anciennitetForIndex.segmentBoundaryIso)
    : segments;
  const segmentsForOverenskomstCalc = (
    loenudviklingBasis === 'Overenskomst' &&
    applyAlmindeligLoenPaaShDageRegel &&
    tafStartIso < STORE_BEDEDAG_START &&
    tafEndIso >= STORE_BEDEDAG_START
  )
    ? splitSegmentsAtBoundary(segmentsForCalc, STORE_BEDEDAG_START)
    : segmentsForCalc;

  if (
    ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst' &&
    reguleringsdato &&
    ansaettelsesforhold.overenskomstId
  ) {
    const effectiveReguleringsdato = resolveOverenskomstEffectiveStartIso(ansaettelsesforhold.overenskomstId, reguleringsdato);
    const fallbackRowWithIso = (segment: LoenudviklingSegment): IndexRowWithIso => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const indeksberegning = Math.abs(indeksValue - 100) < 0.000001 ? '100,00' : `${indeksDisplay} /\n100,00`;
      const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
      return {
        fraIso: segment.fra,
        tilIso: segment.til,
        fraDato: formatDateShort(segment.fra),
        tilDato: formatDateShort(segment.til),
        indeksberegning,
        indeks: indeksDisplay,
        loenudvikling,
        signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
      };
    };

    const offentligType = getOffentligOverenskomstTypeById(ansaettelsesforhold.overenskomstId);
    if (offentligType) {
      const offentligOverenskomstId = ansaettelsesforhold.overenskomstId;
      const baseDato = isoToDanish(effectiveReguleringsdato);
      const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      if (!baseDato || !loenType || typeof trinValue !== 'number' || typeof gruppeValue !== 'number') {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }
      assertOffentligReguleringsDatoGyldig(baseDato);
      if (!isLoengruppe(gruppeValue)) {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }
      let loentrin: ReturnType<typeof toLoentrin>;
      try {
        loentrin = toLoentrin(trinValue);
      } catch {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }

      const baseResult = getOffentligLoenForDato(offentligType, baseDato, loentrin, gruppeValue);
      if (!baseResult) return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      const offentligLoenEkstraGrundloen = resolveOffentligLoenEkstraGrundloen(
        amountValueToNumber(ansaettelsesforhold.offentligLoenEkstraGrundloen),
        tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måned' : 'Time',
        loenType === 'maanedsLoen' ? 'Måned' : 'Time'
      );
      const baseTillaegsSatser = getOffentligTillaegsSatserForDato(
        offentligOverenskomstId,
        baseDato,
        applyAlmindeligLoenPaaShDageRegel
      );
      const førsteSegmentFraDato = isoToDanish(segmentsForOverenskomstCalc[0]?.fra ?? segments[0]?.fra);
      if (førsteSegmentFraDato) {
        assertOffentligReguleringsDatoGyldig(førsteSegmentFraDato);
      }
      const sidsteSegmentTilDato = isoToDanish(
        segmentsForOverenskomstCalc[segmentsForOverenskomstCalc.length - 1]?.til ?? segments[segments.length - 1]?.til
      );
      const periodeTillaegsSatser =
        førsteSegmentFraDato && sidsteSegmentTilDato
          ? getOffentligTillaegsSatserForPeriode(
              offentligOverenskomstId,
              førsteSegmentFraDato,
              sidsteSegmentTilDato,
              applyAlmindeligLoenPaaShDageRegel
            )
          : [];
      const hasShSo =
        hasPctSourceOrInput(baseTillaegsSatser?.shSoSats, ansaettelsesforhold.shSoPct)
        || hasAnyPctSourceOrInput(periodeTillaegsSatser, (sats) => sats.shSoSats, ansaettelsesforhold.shSoPct);
      const hasFritvalg =
        hasPctSourceOrInput(baseTillaegsSatser?.fritvalg, ansaettelsesforhold.fritvalgPct)
        || hasAnyPctSourceOrInput(periodeTillaegsSatser, (sats) => sats.fritvalg, ansaettelsesforhold.fritvalgPct);
      const hasAgPension =
        hasPctSourceOrInput(baseTillaegsSatser?.agPension, ansaettelsesforhold.pensionPct)
        || hasAnyPctSourceOrInput(periodeTillaegsSatser, (sats) => sats.agPension, ansaettelsesforhold.pensionPct);
      const hasStoreBededag =
        applyAlmindeligLoenPaaShDageRegel &&
        (reguleringsdato >= STORE_BEDEDAG_START || segmentsForOverenskomstCalc.some((segment) => segment.til >= STORE_BEDEDAG_START));
      const baseAnciennitet = anciennitetForIndex && effectiveReguleringsdato >= anciennitetForIndex.activeFromIso
        ? anciennitetForIndex.supplementValue
        : 0;
      const baseValue = (loenType === 'maanedsLoen' ? baseResult.maanedsLoen : baseResult.timeLoen) + offentligLoenEkstraGrundloen + baseAnciennitet;
      const baseComponents: FormulaComponents = {
        baseValue,
        feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
        fritvalgPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.fritvalg, ansaettelsesforhold.fritvalgPct),
        shSoPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.shSoSats, ansaettelsesforhold.shSoPct),
        pensionPct: resolvePctPointFromSatsOrInput(baseTillaegsSatser?.agPension, ansaettelsesforhold.pensionPct),
        storeBededagPct: getStoreBededagPct(reguleringsdato),
      };
      const baseVisibility: FormulaVisibility = {
        showFritvalg: hasFritvalg,
        showShSo: hasShSo,
        showPension: hasAgPension,
        showStoreBededag: hasStoreBededag,
      };
      const baseFormula = buildFormulaText(baseComponents, baseVisibility);
      const baseValueRaw = computeFormulaValue(baseComponents);

      const rows = segmentsForOverenskomstCalc.map((segment) => {
        const segmentDato = isoToDanish(segment.fra);
        const segmentResult = segmentDato
          ? getOffentligLoenForDato(offentligType, segmentDato, loentrin, gruppeValue)
          : undefined;
        if (!segmentResult) return fallbackRowWithIso(segment);
        const segmentTillaegsSatser = segmentDato
          ? getOffentligTillaegsSatserForDato(
              offentligOverenskomstId,
              segmentDato,
              applyAlmindeligLoenPaaShDageRegel
            )
          : undefined;
        const segmentAnciennitet = anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso
          ? anciennitetForIndex.supplementValue
          : 0;
        const segmentBase =
          (loenType === 'maanedsLoen' ? segmentResult.maanedsLoen : segmentResult.timeLoen) + offentligLoenEkstraGrundloen + segmentAnciennitet;
        const components: FormulaComponents = {
          baseValue: segmentBase,
          feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
          fritvalgPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.fritvalg, ansaettelsesforhold.fritvalgPct),
          shSoPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.shSoSats, ansaettelsesforhold.shSoPct),
          pensionPct: resolvePctPointFromSatsOrInput(segmentTillaegsSatser?.agPension, ansaettelsesforhold.pensionPct),
          storeBededagPct: getStoreBededagPct(segment.fra),
        };
        const visibility: FormulaVisibility = {
          showFritvalg: hasFritvalg,
          showShSo: hasShSo,
          showPension: hasAgPension,
          showStoreBededag: hasStoreBededag,
        };
        const formula = buildFormulaText(components, visibility);
        const valueRaw = computeFormulaValue(components);
        const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
        const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
        const indeksberegning = buildIndexFormulaDisplay(
          formula,
          baseFormula,
          valueRaw,
          baseValueRaw,
          false
        );
        const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
        return {
          fraIso: segment.fra,
          tilIso: segment.til,
          fraDato: formatDateShort(segment.fra),
          tilDato: formatDateShort(segment.til),
          indeksberegning,
          indeks: indeksDisplay,
          loenudvikling,
          signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
        };
      });
      return mergeConsecutiveRowsWithSameCalculation(rows);
    }

    const ref = resolveOverenskomstRef(ansaettelsesforhold.overenskomstId);
    const baseDato = isoToDanish(effectiveReguleringsdato);
    if (ref && baseDato) {
      const baseSats = getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: baseDato,
        applyAlmindeligLoenPaaShDageRegel,
      });
      if (baseSats) {
        const allSatser = getOverenskomst(ref.baseId)?.satser ?? [];
        const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
        const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
        const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
        const firstSegmentStartIso = segmentsForOverenskomstCalc[0]?.fra ?? segments[0]?.fra;
        const lastSegmentEndIso = segmentsForOverenskomstCalc[segmentsForOverenskomstCalc.length - 1]?.til ?? segments[segments.length - 1]?.til;
        const applyStoreBededagRegulering = Boolean(
          firstSegmentStartIso &&
          lastSegmentEndIso &&
          applyAlmindeligLoenPaaShDageRegel &&
          firstSegmentStartIso < STORE_BEDEDAG_START &&
          lastSegmentEndIso >= STORE_BEDEDAG_START
        );
        const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
        const baseAnciennitet = anciennitetForIndex && effectiveReguleringsdato >= anciennitetForIndex.activeFromIso
          ? anciennitetForIndex.supplementValue
          : 0;
        const baseComponents: FormulaComponents = {
          baseValue: (baseSats.grundloen ?? 0) + baseAnciennitet,
          feriePct,
          fritvalgPct: percentFromDecimal(baseSats.fritvalg),
          shSoPct: percentFromDecimal(baseSats.shSoSats),
          pensionPct: percentFromDecimal(baseSats.agPension),
          storeBededagPct: 0,
        };
        const baseVisibility: FormulaVisibility = {
          showFritvalg: hasFritvalg,
          showShSo: hasShSo,
          showPension: hasAgPension,
          showStoreBededag: false,
        };
        const baseFormula = buildFormulaText(baseComponents, baseVisibility);
        const baseValueRaw = computeFormulaValue(baseComponents);

        const rows = segmentsForOverenskomstCalc.map((segment) => {
          const segmentDato = isoToDanish(segment.fra);
          const sats = segmentDato
            ? getEffektiveSatserForDato({
                overenskomstId: ref.baseId,
                dato: segmentDato,
                applyAlmindeligLoenPaaShDageRegel,
              })
            : undefined;

          if (!sats) {
            return fallbackRowWithIso(segment);
          }

          const storeBededagPct =
            applyStoreBededagRegulering && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
          const segmentAnciennitet = anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso
            ? anciennitetForIndex.supplementValue
            : 0;
          const components: FormulaComponents = {
            baseValue: (sats.grundloen ?? 0) + segmentAnciennitet,
            feriePct,
            fritvalgPct: percentFromDecimal(sats.fritvalg),
            shSoPct: percentFromDecimal(sats.shSoSats),
            pensionPct: percentFromDecimal(sats.agPension),
            storeBededagPct,
          };
          const visibility: FormulaVisibility = {
            showFritvalg: hasFritvalg,
            showShSo: hasShSo,
            showPension: hasAgPension,
            showStoreBededag: applyStoreBededagRegulering,
          };
          const formula = buildFormulaText(components, visibility);
          const valueRaw = computeFormulaValue(components);
          const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
          const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
          const indeksberegning = buildIndexFormulaDisplay(
            formula,
            baseFormula,
            valueRaw,
            baseValueRaw,
            false
          );
          const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
          return {
            fraIso: segment.fra,
            tilIso: segment.til,
            fraDato: formatDateShort(segment.fra),
            tilDato: formatDateShort(segment.til),
            indeksberegning,
            indeks: indeksDisplay,
            loenudvikling,
            signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
          };
        });
        return mergeConsecutiveRowsWithSameCalculation(rows);
      }
    }
  }

  const baseIndex = (() => {
    if (!reguleringsdato) return null;
    if (loenudviklingBasis === 'Manuelt angivet') {
      const baseRow = (ansaettelsesforhold.loenudviklingManuelTableData ?? [])[0];
      return {
        components: {
          baseValue: parseAmount(baseRow?.grundloen),
          feriePct: resolveFeriePctForFormula(baseRow?.feriepenge, ansaettelsesforhold.feriePct),
          fritvalgPct: parsePercentInput(baseRow?.fritvalg),
          shSoPct: parsePercentInput(baseRow?.shSoSats),
          pensionPct: parsePercentInput(baseRow?.agPension),
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      };
    }
    if (loenudviklingBasis === 'Statistik') {
      if (statistikModelLabel === '') return null;
      if (isAslModel) {
        const regDate = parseIsoDateToUtcDate(reguleringsdato);
        if (!regDate) return null;
        const value = aarsloenAslMax[regDate.getUTCFullYear() as keyof typeof aarsloenAslMax];
        if (typeof value !== 'number') return null;
        return {
          components: {
            baseValue: value,
            feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
            fritvalgPct: typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0,
            shSoPct: typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0,
            pensionPct: typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0,
            storeBededagPct: 0,
          },
          visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
        };
      }
      const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
      if (!modelId) return null;
      const model = getStatistiskLoenudvikling(modelId);
      if (!model) return null;
      const periodStarts = model.indeksvaerdier
        .flatMap((value) => {
          const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
          if (!match) return [];
          const year = Number(match[1]);
          const quarter = Number(match[2]);
          if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
          const month = (quarter - 1) * 3 + 1;
          const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
          if (!startIso) return [];
          return [{ startIso, indeksvaerdi: value.indeksvaerdi }];
        })
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      if (periodStarts.length === 0) return null;
      let candidate = periodStarts[0];
      for (const period of periodStarts) {
        if (period.startIso > reguleringsdato) break;
        candidate = period;
      }
      return {
        components: {
          baseValue: candidate.indeksvaerdi,
          feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
          fritvalgPct: typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0,
          shSoPct: typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0,
          pensionPct: typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0,
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      };
    }
    if (isKRL) {
      const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
      if (!krlId || !isKRLSatstabelId(krlId)) return null;
      const tabel = getKRLSatstabel(krlId);
      if (!tabel || tabel.vaerdier.length === 0) return null;
      const periodStarts = tabel.vaerdier
        .map((v) => {
          const startIso = parseDanishToISO(v.fraDato);
          if (!startIso) return null;
          return { startIso, reguleringsPct: v.reguleringsPct };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      if (periodStarts.length === 0) return null;
      let candidate = periodStarts[0];
      for (const period of periodStarts) {
        if (period.startIso > reguleringsdato) break;
        candidate = period;
      }
      return {
        components: {
          baseValue: 100 + candidate.reguleringsPct,
          feriePct: 0,
          fritvalgPct: 0,
          shSoPct: 0,
          pensionPct: 0,
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
      };
    }
    return null;
  })();

  const baseComponents = baseIndex?.components;
  const baseVisibility = baseIndex?.visibility;
  const baseValueRaw = baseComponents
    ? (isSimpleIndex ? baseComponents.baseValue : computeFormulaValue(baseComponents))
    : null;
  const baseFormula = baseComponents && baseVisibility
    ? (isSimpleIndex ? formatStatValue(baseComponents.baseValue) : buildFormulaText(baseComponents, baseVisibility))
    : null;

  const periods: ReguleringsPeriode[] = (() => {
    if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return [];
    const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
    if (loenudviklingBasis === 'Manuelt angivet') {
      const rows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];
      const baseRow = rows[0];
      const baseComponents: FormulaComponents = {
        baseValue: parseAmount(baseRow?.grundloen),
        feriePct: resolveFeriePctForFormula(baseRow?.feriepenge, feriePct),
        fritvalgPct: parsePercentInput(baseRow?.fritvalg),
        shSoPct: parsePercentInput(baseRow?.shSoSats),
        pensionPct: parsePercentInput(baseRow?.agPension),
        storeBededagPct: 0,
      };
      const periodStarts = [
        { startIso: tafStartIso, components: baseComponents },
        ...rows.slice(1).map((row) => {
          const startIso = parseDanishToISO(row.dato);
          if (!startIso) return null;
          if (startIso < tafStartIso) return null;
          if (tafEndIso && startIso > tafEndIso) return null;
          const components: FormulaComponents = {
            baseValue: parseAmount(row.grundloen),
            feriePct: resolveFeriePctForFormula(row.feriepenge, feriePct),
            fritvalgPct: parsePercentInput(row.fritvalg),
            shSoPct: parsePercentInput(row.shSoSats),
            pensionPct: parsePercentInput(row.agPension),
            storeBededagPct: 0,
          };
          return { startIso, components };
        }),
      ]
        .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

      const applyStoreBededagRegulering =
        applyAlmindeligLoenPaaShDageRegel && tafStartIso < STORE_BEDEDAG_START && tafEndIso >= STORE_BEDEDAG_START;

      if (applyStoreBededagRegulering) {
        const baseForStore = [...periodStarts]
          .filter((period) => period.startIso <= STORE_BEDEDAG_START)
          .sort((a, b) => (a.startIso < b.startIso ? 1 : -1))[0];
        if (baseForStore && !periodStarts.some((p) => p.startIso === STORE_BEDEDAG_START)) {
          periodStarts.push({
            startIso: STORE_BEDEDAG_START,
            components: {
              ...baseForStore.components,
              storeBededagPct: STORE_BEDEDAG_PCT,
            },
          });
        }
        const updated = periodStarts.map((period) => {
          if (period.startIso < STORE_BEDEDAG_START) return period;
          return {
            ...period,
            components: {
              ...period.components,
              storeBededagPct: STORE_BEDEDAG_PCT,
            },
          };
        });
        periodStarts.length = 0;
        periodStarts.push(...updated);
        periodStarts.sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      }

      return periodStarts.map((period) => ({
        ...period,
        visibility: {
          showFritvalg: true,
          showShSo: true,
          showPension: true,
          showStoreBededag: applyStoreBededagRegulering,
        },
      }));
    }
    if (loenudviklingBasis === 'Statistik') {
      const fritvalgPct = typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0;
      const shSoPct = typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0;
      const pensionPct = typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0;
      if (statistikModelLabel === '') return [];
      if (isAslModel) {
        const start = parseIsoDateToUtcDate(tafStartIso);
        const end = parseIsoDateToUtcDate(tafEndIso);
        if (!start || !end) return [];
        const startYear = start.getUTCFullYear();
        const endYear = end.getUTCFullYear();
        const periodStarts: Array<{ startIso: ISODateString; components: FormulaComponents }> = [];
        for (let year = startYear; year <= endYear; year += 1) {
          const value = aarsloenAslMax[year as keyof typeof aarsloenAslMax];
          if (typeof value !== 'number') continue;
          const startIso = parseOptionalIsoDate(`${year}-01-01`);
          if (!startIso) continue;
          periodStarts.push({
            startIso,
            components: {
              baseValue: value,
              feriePct,
              fritvalgPct,
              shSoPct,
              pensionPct,
              storeBededagPct: 0,
            },
          });
        }
        return periodStarts
          .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
          .map((period) => ({
            ...period,
            visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
          }));
      }
      const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
      if (!modelId) return [];
      const model = getStatistiskLoenudvikling(modelId);
      if (!model) return [];
      const periodStarts = model.indeksvaerdier
        .flatMap((value) => {
          const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
          if (!match) return [];
          const year = Number(match[1]);
          const quarter = Number(match[2]);
          if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
          const month = (quarter - 1) * 3 + 1;
          const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
          if (!startIso) return [];
          return [{
            startIso,
            components: {
              baseValue: value.indeksvaerdi,
              feriePct,
              fritvalgPct,
              shSoPct,
              pensionPct,
              storeBededagPct: 0,
            },
          }];
        })
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      return periodStarts.map((period) => ({
        ...period,
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      }));
    }
    if (isKRL) {
      const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
      if (!krlId || !isKRLSatstabelId(krlId)) return [];
      const tabel = getKRLSatstabel(krlId);
      if (!tabel || tabel.vaerdier.length === 0) return [];
      const periodStarts = tabel.vaerdier
        .map((v) => {
          const startIso = parseDanishToISO(v.fraDato);
          if (!startIso) return null;
          return {
            startIso,
            components: {
              baseValue: 100 + v.reguleringsPct,
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              pensionPct: 0,
              storeBededagPct: 0,
            },
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      return periodStarts.map((period) => ({
        ...period,
        visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
      }));
    }
    return [];
  })();

  if (!baseComponents || !baseVisibility || baseValueRaw === null || baseFormula === null || periods.length === 0) {
    return mergeConsecutiveRowsWithSameCalculation(segments.map((segment) => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const formulaText = Math.abs(indeksValue - 100) < 0.000001 ? '100,00' : `${indeksDisplay} /\n100,00`;
      return {
        fraIso: segment.fra,
        tilIso: segment.til,
        fraDato: formatDateShort(segment.fra),
        tilDato: formatDateShort(segment.til),
        indeksberegning: formulaText,
        indeks: indeksDisplay,
        loenudvikling: formatLoenudviklingFromIndex(indeksValue),
        signature: `${formulaText}|${indeksDisplay}|${formatLoenudviklingFromIndex(indeksValue)}`,
      };
    }));
  }

  return mergeConsecutiveRowsWithSameCalculation(segments.map((segment) => {
    const period = findPeriodForDate(periods, segment.fra);
    const components = period?.components ?? baseComponents;
    const visibility = period?.visibility ?? baseVisibility;
    const valueRaw = isSimpleIndex ? components.baseValue : computeFormulaValue(components);
    const formula = isSimpleIndex ? formatStatValue(valueRaw) : buildFormulaText(components, visibility);
    const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
    const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
    const indeksberegning = buildIndexFormulaDisplay(formula, baseFormula, valueRaw, baseValueRaw, isSimpleIndex);
    const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
    return {
      fraIso: segment.fra,
      tilIso: segment.til,
      fraDato: formatDateShort(segment.fra),
      tilDato: formatDateShort(segment.til),
      indeksberegning,
      indeks: indeksDisplay,
      loenudvikling,
      signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
    };
  }));
};
