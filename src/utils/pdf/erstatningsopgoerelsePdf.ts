/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import { type RowInput } from 'jspdf-autotable';
import { PDF_FONT_FAMILY, PDF_FONT_STYLES } from './pdfConfig';
import { PDF_TITLE_BOTTOM_SPACING_MM, type BrevhovedData } from './pdfHelpers';
import { createPdfWriter } from './pdfWriter';
import { renderEoStylePdfTable } from './pdfTableRenderer';
import type { ISODateString } from '../../types/branded';
import { isoToDanish, subtractOneDay } from '../../types/branded';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../schemas/formSchemas';
import { buildErstatningsopgoerelsePdfModel, type MoneyOre, type Calculable, type LoenudviklingSegment } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { getAngivetLoenOpreguleresFraDato } from '../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { formatAsAmount, formatCurrency, formatPercent as formatPercentUtil } from '../formatUtils';
import { parseAmount } from '../numberParsing';
import { roundByMethod } from '../rounding';
import { parseISODate } from '../../types/branded';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { STORE_BEDEDAG_START, TODAY } from '../../config/dateRanges';
import { STORE_BEDEDAG_PCT } from '../../config/regulatoryRates';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';

import { aarsloenMax } from '../../data/regulationRates';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  getOverenskomst,
  getOffentligOverenskomstTypeById,
  resolveOverenskomstNameOnlyDisplay,
  resolveOverenskomstRef,
} from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import { getStatistiskLoenudvikling } from '../../data/statistiskLoenudviklingRates';
import { formatKRLSatstabelDisplay, getKRLSatstabel, isKRLSatstabelId } from '../../data/KRLrates';
import { clampTafRow, resolveTafConstraintBounds } from '../../domain/erstatningsopgoerelse/tafPeriodConstraints';
import { logWarning } from '../logger';
import {
  buildBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldIncludeLoenRowInBilag,
  shouldIncludeOffentligYdelseRowInBilag,
  shouldIncludeReguleringBilag,
} from '../../domain/erstatningsopgoerelse/bilagRules';
import { resolveValgtReguleringDisplay } from '../../domain/erstatningsopgoerelse/loenudviklingDisplay';
import {
  convertAnciennitetSats,
  formatAmountWithoutTrailingDecimals,
  hasAnyPctSourceOrInput,
  hasPctSourceOrInput,
  numOrZero,
  resolvePctPointFromSatsOrInput,
  resolveOffentligLoenEkstraGrundloen,
  resolveReguleringsdato as resolveReguleringsdatoShared,
  resolveStatistikModelId,
  parseOptionalIsoDate as parseOptionalIsoDateShared,
  parseDanishToIso as parseDanishToIsoShared,
  formatDateShort as formatDateShortShared,
  formatDateLong as formatDateLongShared,
  roundToTwoDecimals,
  detectDecimalPlaces,
} from '../../domain/erstatningsopgoerelse/sharedPdfUtils';
import {
  buildFormulaText,
  computeFormulaValue,
  formatOverenskomstAmount,
  formatOverenskomstPercent,
  formatPercentCellFromRaw,
  mergeFeriepengeDisplay,
  parsePercentInput,
  resolveFeriePctForFormula,
  wrapIndexFormulaAfterSlashWhenLong,
  type FormulaComponents,
  type FormulaVisibility,
} from '../../domain/erstatningsopgoerelse/reguleringFormulaUtils';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatPercentDelta,
  isSingularCount,
  resolvePdfFileName,
} from './pdfFormatUtils';
import { maxISO, minISO } from '../isoDateHelpers';
import type { ReguleringIndexRow, ReguleringValuesTableData, SelectedElements } from './erstatningsopgoerelse/types';
import { assertNoUnsupportedSygeferiegodtgoerelseSelection } from './erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection';
import { renderLoenindkomstSection } from './erstatningsopgoerelse/sections/loenindkomstSection';
import { renderOffentligeYdelserSection } from './erstatningsopgoerelse/sections/offentligeYdelserSection';
import { renderShDageSection } from './erstatningsopgoerelse/sections/shDageSection';
import { renderReguleringSection } from './erstatningsopgoerelse/sections/reguleringSection';
import { renderOpgorelseSection } from './erstatningsopgoerelse/sections/opgoerelseSection';

const NBSP = '\u00A0';
const EO_RIGHT_COLUMN_WIDTH = 33.125;
const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const EO_LEFT_WRAP_EXTRA_WIDTH_PX = 50;
const EO_LEFT_WRAP_EXTRA_WIDTH_MM = (EO_LEFT_WRAP_EXTRA_WIDTH_PX * MILLIMETERS_PER_INCH) / CSS_PIXELS_PER_INCH;

const renderMoney = (value: Calculable<MoneyOre>): string => {
  return value.status === 'ok' ? formatCurrencyFromOre(value.value) : '—';
};

const renderMoneyWithKr = (value: Calculable<MoneyOre>): string => {
  const rendered = renderMoney(value);
  return rendered === '—' ? '—' : `${rendered}${NBSP}kr.`;
};

const renderMoneyWithKrOrError = (value: Calculable<MoneyOre>): string => {
  if (value.status === 'ok') return `${formatCurrencyFromOre(value.value)}${NBSP}kr.`;
  return `Fejl (${value.reason})`;
};

/** Formaterer øre-beløb uden decimaler når de er ,00 */
const formatCurrencyFromOreTrimmed = (ore: MoneyOre): string => {
  const formatted = formatCurrencyFromOre(ore);
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

const renderMoneyWithKrTrimmed = (value: Calculable<MoneyOre>): string => {
  if (value.status !== 'ok') return '—';
  return `${formatCurrencyFromOreTrimmed(value.value)}${NBSP}kr.`;
};

const formatMoneyOreWithKrTrimmed = (ore: MoneyOre): string => `${formatCurrencyFromOreTrimmed(ore)}${NBSP}kr.`;

const isLoengruppe = (value: number): value is Loengruppe =>
  Number.isInteger(value) && value >= 0 && value <= 4;

const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
};

const isZeroPct = (value: number | undefined): boolean => Math.abs(value ?? 0) < 0.000001;
const capitalizeFirstChar = (value: string): string => {
  if (value.length === 0) return value;
  return `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}`;
};

const getLoenindkomstTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  const periodColumns =
    loenperiode === 'maaned'
      ? ['Måned', 'År']
      : loenperiode === 'uge'
        ? ['Uge fra', 'Uge til']
        : ['Dato fra', 'Dato til'];

  return [
    ...periodColumns,
    'Grundløn',
    'Tillæg',
    'Ikke-pens. giv. løn',
    'ATP mv.\nu. FP',
    'Ferieber.\nløn',
    'FP/FV/SH/\nSO/St.B.',
    'Arb.g. Pension',
    'Samlet løn',
  ];
};

const resolvePeriodColumns = (row: AarsloenTableRow, loenperiode: Loenperiode): readonly [string, string] => {
  if (loenperiode === 'maaned') {
    return [row.col0_maaned?.trim() ?? '', row.col1_maaned?.trim() ?? ''];
  }
  if (loenperiode === 'uge') {
    return [row.col0_uge?.trim() ?? '', row.col1_uge?.trim() ?? ''];
  }
  return [row.col0_dag?.trim() ?? '', row.col1_dag?.trim() ?? ''];
};

// STORE_BEDEDAG_START og STORE_BEDEDAG_PCT importeret fra config

const renderStandardPdfTable = (params: Readonly<{
  doc: jsPDF;
  startY: number;
  body: RowInput[];
  columnStyles?: NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'];
  transparentRowIndices?: readonly number[];
}>): number => {
  const { doc, startY, body, columnStyles, transparentRowIndices } = params;
  return renderEoStylePdfTable({
    doc,
    startY,
    body,
    columnStyles,
    transparentRowIndices,
  });
};

const parseIsoDateToUtcDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  return parseISODate(iso) ?? null;
};

const parseOptionalIsoDate = parseOptionalIsoDateShared;
type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

const resolveReguleringTableStartIso = (
  reguleringsdato: ISODateString | undefined,
  tafFra: ISODateString
): ISODateString => {
  if (!reguleringsdato) return tafFra;
  return reguleringsdato < tafFra ? reguleringsdato : tafFra;
};

const resolveTafDateBounds = (
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

const resolveReguleringsdato = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | undefined => resolveReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
  skadesdato: stamdataValues.skadesdato,
});

const resolveLoenSkadesdatoText = (params: {
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

const parseDanishToISO = parseDanishToIsoShared;

const resolveStatistikModelIdFromLabel = resolveStatistikModelId;


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
  return candidate ?? periods[0];
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

const buildReguleringsvaerdierTableData = (params: Readonly<{
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

      const fraDato = isoToDanish(reguleringTableStartIso);
      const tilDato = isoToDanish(tafTil);
      if (!fraDato || !tilDato) return null;
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
      const visMaanedsloen = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
      const columns = [
        'Fra-dato',
        ...(visMaanedsloen ? ['Månedsløn'] : ['Timeløn']),
        ...(hasShSo ? ['SH/SO'] : []),
        ...(hasFritvalg ? ['Fritvalg'] : []),
        ...(hasAgPension ? ['AG pension'] : []),
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
          visMaanedsloen ? maanedsLoenDisplay : timeLoenDisplay,
          ...(hasShSo ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.shSoSats, ansaettelsesforhold.shSoPct))] : []),
          ...(hasFritvalg ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.fritvalg, ansaettelsesforhold.fritvalgPct))] : []),
          ...(hasAgPension ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.agPension, ansaettelsesforhold.pensionPct))] : []),
        ]);
      };

      addRow(reguleringTableStartIso, baseResult.maanedsLoen, baseResult.timeLoen);

      const rowDates = new Set<ISODateString>();
      for (const entry of satser) {
        const iso = parseDanishToISO(entry.effectiveDate);
        if (!iso) continue;
        if (iso > reguleringTableStartIso && iso <= tafTil) rowDates.add(iso);
      }
      for (const entry of tillaegsSatser) {
        const iso = parseDanishToISO(entry.fraDato);
        if (!iso) continue;
        if (iso > reguleringTableStartIso && iso <= tafTil) rowDates.add(iso);
      }
      if (harAnciennitetstillaeg && anciennitetDatoIso && anciennitetDatoIso > reguleringTableStartIso && anciennitetDatoIso <= tafTil) {
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

      return { columns, rows };
    }

    const ref = resolveOverenskomstRef(overenskomstId);
    if (!ref) return null;
    const fraDato = isoToDanish(reguleringTableStartIso);
    const tilDato = isoToDanish(tafTil);
    if (!fraDato || !tilDato) return null;

    const satser = getEffektiveSatserForPeriode({
      overenskomstId: ref.baseId,
      fraDato,
      tilDato,
      applyAlmindeligLoenPaaShDageRegel: ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn',
    }).slice().reverse();
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
    const columns = [
      'Fra-dato',
      ...(hasGrundloen ? ['Grundløn'] : []),
      ...(hasGrundloen && showFeriePctColumn ? ['Feriepenge'] : []),
      ...(hasShSo ? ['SH/SO'] : []),
      ...(hasFritvalg ? ['Fritvalg'] : []),
      ...(hasAgPension ? ['AG pension'] : []),
      ...(hasSfgg ? ['SFGG'] : []),
      ...(hasSfggFaglKbh ? ['SFGG\nfagl. Kbh'] : []),
      ...(hasSfggFaglProv ? ['SFGG\nfagl. prov'] : []),
      ...(hasSfggUfaglKbh ? ['SFGG\nufagl. Kbh'] : []),
      ...(hasSfggUfaglProv ? ['SFGG\nufagl. prov'] : []),
    ] as const;
    const rows = satser.map((sats) => {
      const row: string[] = [sats.fraDato];
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
    });
    return { columns, rows };
  }

  if (grundlag === 'Manuelt angivet') {
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
    const rows = (ansaettelsesforhold.loenudviklingManuelTableData ?? [])
      .map((row, index) => {
        const iso = index === 0 ? reguleringTableStartIso : parseDanishToISO(row.dato);
        if (!iso || iso < reguleringTableStartIso || iso > tafTil) return null;
        const cells: string[] = [
          formatDateShort(iso),
          amountValueToDisplayString(row.grundloen, 2) || '-',
        ];
        cells.push(
          mergeFeriepengeDisplay(showFeriePctColumn ? feriePctDisplay : undefined, formatPercentCellFromRaw(row.feriepenge)),
          formatPercentCellFromRaw(row.shSoSats),
          formatPercentCellFromRaw(row.fritvalg),
          formatPercentCellFromRaw(row.agPension)
        );
        return { iso, cells };
      })
      .filter((row): row is Readonly<{ iso: ISODateString; cells: string[] }> => Boolean(row))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1))
      .map((row) => row.cells);
    return {
      columns: [
        'Dato',
        'Grundløn',
        'Feriepenge',
        'SH/SO',
        'Fritvalg',
        'AG pension',
      ],
      rows,
    };
  }

  if (grundlag === 'Statistik') {
    const modelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
    if (modelLabel === '') return null;

    if (modelLabel.startsWith('ASL-')) {
      const regDate = parseIsoDateToUtcDate(reguleringsdato);
      const tafFraDate = parseIsoDateToUtcDate(reguleringTableStartIso);
      const tafTilDate = parseIsoDateToUtcDate(tafTil);
      if (!regDate || !tafFraDate || !tafTilDate) return null;
      const regYear = regDate.getUTCFullYear();
      const startYear = tafFraDate.getUTCFullYear();
      const endYear = tafTilDate.getUTCFullYear();
      const rows: string[][] = [];
      const regValue = aarsloenMax[regYear as keyof typeof aarsloenMax];
      if (typeof regValue === 'number') rows.push([String(regYear), formatCurrency(regValue)]);
      for (let year = startYear; year <= endYear; year += 1) {
        if (year === regYear) continue;
        const value = aarsloenMax[year as keyof typeof aarsloenMax];
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

const buildReguleringIndexRows = (params: Readonly<{
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
  const isAslModel = isStatistik && statistikModelLabel.startsWith('ASL-');
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

  type IndexRowWithIso = ReguleringIndexRow & Readonly<{
    fraIso: ISODateString;
    tilIso: ISODateString;
    signature: string;
  }>;

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

  if (
    ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst' &&
    reguleringsdato &&
    ansaettelsesforhold.overenskomstId
  ) {
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
      const baseDato = isoToDanish(reguleringsdato);
      const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      if (!baseDato || !loenType || typeof trinValue !== 'number' || typeof gruppeValue !== 'number') {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }
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
      const førsteSegmentFraDato = isoToDanish(segmentsForCalc[0]?.fra ?? segments[0]?.fra);
      const sidsteSegmentTilDato = isoToDanish(
        segmentsForCalc[segmentsForCalc.length - 1]?.til ?? segments[segments.length - 1]?.til
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
        (reguleringsdato >= STORE_BEDEDAG_START || segmentsForCalc.some((segment) => segment.til >= STORE_BEDEDAG_START));
      const baseAnciennitet = anciennitetForIndex && reguleringsdato >= anciennitetForIndex.activeFromIso
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

      const rows = segmentsForCalc.map((segment) => {
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
    const baseDato = isoToDanish(reguleringsdato);
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
        const firstSegmentStartIso = segments[0]?.fra;
        const lastSegmentEndIso = segments[segments.length - 1]?.til;
        const applyStoreBededagRegulering = Boolean(
          firstSegmentStartIso &&
          lastSegmentEndIso &&
          applyAlmindeligLoenPaaShDageRegel &&
          firstSegmentStartIso < STORE_BEDEDAG_START &&
          lastSegmentEndIso >= STORE_BEDEDAG_START
        );
        const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
        const baseAnciennitet = anciennitetForIndex && reguleringsdato >= anciennitetForIndex.activeFromIso
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

        const rows = segmentsForCalc.map((segment) => {
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
        const value = aarsloenMax[regDate.getUTCFullYear() as keyof typeof aarsloenMax];
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
          const value = aarsloenMax[year as keyof typeof aarsloenMax];
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
    return segments.map((segment) => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const formulaText = Math.abs(indeksValue - 100) < 0.000001 ? '100,00' : `${indeksDisplay} /\n100,00`;
      return {
        fraDato: formatDateShort(segment.fra),
        tilDato: formatDateShort(segment.til),
        indeksberegning: formulaText,
        indeks: indeksDisplay,
        loenudvikling: formatLoenudviklingFromIndex(indeksValue),
      };
    });
  }

  return segments.map((segment) => {
    const period = findPeriodForDate(periods, segment.fra);
    const components = period?.components ?? baseComponents;
    const visibility = period?.visibility ?? baseVisibility;
    const valueRaw = isSimpleIndex ? components.baseValue : computeFormulaValue(components);
    const formula = isSimpleIndex ? formatStatValue(valueRaw) : buildFormulaText(components, visibility);
    const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
    const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
    return {
      fraDato: formatDateShort(segment.fra),
      tilDato: formatDateShort(segment.til),
      indeksberegning: buildIndexFormulaDisplay(formula, baseFormula, valueRaw, baseValueRaw, isSimpleIndex),
      indeks: indeksDisplay,
      loenudvikling: formatLoenudviklingFromIndex(indeksValue),
    };
  });
};

export const resolveUdkastStempelValue = (value: unknown): boolean => {
  return value === 'Ja';
};


/**
 * Månedsnavn på dansk (med små bogstaver)
 */
const formatDateShort = formatDateShortShared;

const formatDateLong = formatDateLongShared;





/**
 * Options for erstatningsopgørelse PDF
 */
interface ErstatningsopgoerelsePdfOptions {
  visBrevhoved?: boolean;
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje';
  visUdkastStempel?: boolean;
}

/**
 * Generer og download PDF for erstatningsopgørelse
 *
 * @param {StamdataValues} stamdataValues - Stamdata fra FormPersistence
 * @param {ErstatningsopgoerelseValues} eoValues - EO-oplysninger fra FormPersistence
 * @param {SelectedElements} selectedElements - Valgte elementer til PDF
 * @param {ErstatningsopgoerelsePdfOptions} options - Valgfrie indstillinger
 */
export const generateErstatningsopgoerelsePdf = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  selectedElements: SelectedElements,
  options: ErstatningsopgoerelsePdfOptions = {}
) => {
  if (!selectedElements.opgoerelse) {
    throw new Error('PDF-generering kræver, at elementet "Opgørelse" er valgt.');
  }

  assertNoUnsupportedSygeferiegodtgoerelseSelection(selectedElements);

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;
  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });
  const bilagIndkomstYdelserMode: BilagLoenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const bilagIndkomstYdelserRanges = buildBilagIndkomstYdelserRanges(eoValues, bilagIndkomstYdelserMode);
  const titel = model.titel;

  const warnLayoutFallback = (message: string) => {
    logWarning('PDF-layout fallback aktiveret', {
      context: 'pdf.erstatningsopgoerelse.layout',
      data: { message },
    });
  };

  const writer = createPdfWriter({
    lineHeight,
    doubleLineHeight,
    visUdkastStempel,
    onLayoutFallback: warnLayoutFallback,
  });
  writer.setDisplayMode('fullheight');

  // Dokumentets metadata
  writer.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  const renderSectionHeader = (text: string, nextLineHeight: number) => {
    writer.writeSectionHeader(text, nextLineHeight);
  };

  const renderSubheader = (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => {
    writer.writeSubheader(text, nextLineHeight, options);
  };

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
  };

  const renderSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    writer.writeSubheaderWithWrappedText(subheaderText, bodyText);
  };

  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      {
        ...options,
        minRightColumnWidth: Math.max(
          rightMaxWidth,
          Math.max(0, EO_RIGHT_COLUMN_WIDTH - EO_LEFT_WRAP_EXTRA_WIDTH_MM)
        ),
      }
    );
  };

  const standardRightMaxWidth = writer.getTextWidth('000.000.000,00');

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstChar(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const startBilagPage = (titleText: string) => {
    writer.addPage();
    writer.writeTitle(titleText);
  };

  const renderAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, headerHeight } = params;
    writer.writeAtomicTableChunks({ rows, renderHeader, renderRow, estimateRowHeight, headerHeight });
  };

  const assertModelInvariant = (condition: boolean, message: string) => {
    if (condition) return;
    const invariantMessage = `Inkonsekvent PDF-model: ${message}`;
    throw new Error(invariantMessage);
  };

  writer.addUdkastWatermark();

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel
  writer.writeTitle(titel);
  writer.advanceY(-(PDF_TITLE_BOTTOM_SPACING_MM - lineHeight));

  // Tilføj erstatningsperiode-datoer direkte under titel
  writer.setNormalTextStyle();
  if (model.periodeDisplay) {
    safeAddWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Tilføj skadelidtes navn (fed skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  if (model.skadelidteNavn) {
    safeAddWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  if (model.skadestypeLinje) {
    safeAddWrappedText(model.skadestypeLinje);
    writer.advanceY(lineHeight);
  }

  renderOpgorelseSection({
    model,
    eoValues,
    stamdataValues,
    lineHeight,
    doubleLineHeight,
    afsluttesMed,
    NBSP,
    rightColumnWidth: EO_RIGHT_COLUMN_WIDTH,
    renderSectionHeader,
    renderSubheader,
    renderSubheaderWithWrappedText,
    safeAddWrappedText,
    safeAddLeftRightText,
    renderAtomicTableChunks,
    assertModelInvariant,
    renderMoneyWithKr,
    renderMoneyWithKrTrimmed,
    renderMoneyWithKrOrError,
    formatMoneyOreWithKr,
    formatMoneyOreWithKrTrimmed,
    formatCurrencyFromOre,
    formatCurrencyFromOreTrimmed,
    formatCountWithUnit,
    formatMaanederTrimmed,
    isSingularCount,
    parseOptionalIsoDate,
    resolveLoenSkadesdatoText,
    formatDateShort,
    formatDateLong,
    formatPercentDelta,
    writer,
  });

  const skalFiltrereBilagTilKunPerioden =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar === 'Perioden';
  const skalViseIndkomstOgYdelserBilag =
    !skalFiltrereBilagTilKunPerioden || model.tabtArbejdsfortjeneste.harTafPerioder;

  if (selectedElements.loenindkomst && skalViseIndkomstOgYdelserBilag) {
    renderLoenindkomstSection({
      selectedElements,
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      writeLabelValueLine,
      formatJaNej,
      formatDateLong,
      resolveOverenskomstDisplay: resolveOverenskomstNameOnlyDisplay,
      formatPctFromInput,
      isZeroPct,
      getLoenindkomstTableHeaders,
      resolvePeriodColumns,
      hasNonZeroLoenAmount,
      shouldIncludeLoenRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.offentligeYdelser && skalViseIndkomstOgYdelserBilag) {
    renderOffentligeYdelserSection({
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      shouldIncludeOffentligYdelseRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.regulering && skalViseIndkomstOgYdelserBilag && shouldIncludeReguleringBilag(eoValues)) {
    renderReguleringSection({
      eoValues,
      stamdataValues,
      lineHeight,
      modelLoenudviklingSegmenter: model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [],
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      writeLabelValueLine,
      resolveValgtReguleringDisplay,
      resolveReguleringsdato,
      parseOptionalIsoDate,
      resolveLoenSkadesdatoText,
      resolveTafDateBounds,
      buildReguleringsvaerdierTableData,
      buildReguleringIndexRows: (params) => buildReguleringIndexRows({
        ...params,
        tafBeregningsenhed: model.tabtArbejdsfortjeneste.tafBeregningsenhed,
      }),
      resolveStatistikModelIdFromLabel,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.shDage) {
    renderShDageSection({
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles, transparentRowIndices }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
          transparentRowIndices,
        }),
      writer,
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
