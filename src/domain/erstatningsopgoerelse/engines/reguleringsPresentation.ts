import type { DanishDateString, ISODateString } from '../../../types/branded';
import { isoToDanish, parseISODate } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, LoenudviklingManuelRow, StamdataValues } from '../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../shared/eoTypes';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { clampTafRow, resolveTafConstraintBounds } from '../validation/tafPeriodConstraints';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
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
  resolveAnvendtReguleringsdato as resolveAnvendtReguleringsdatoShared,
  isAslStatistikModel,
  resolveStatistikModelId,
} from '../helpers/eoSharedUtils';
import { round2 as roundToTwoDecimals } from '../../../utils/roundingShortcuts';
import { maxISO, minISO, sortIsoDates } from '../../../utils/isoDateHelpers';
import { amountValueToDisplayString, amountValueToNumber } from '../../../utils/expressionAmount';
import { formatAsAmount, formatCurrency, formatPercent as formatPercentUtil } from '../../../utils/formatUtils';
import { formatISOToDanish, formatIsoDateLong } from '../../../utils/dateFormatting';
import { parseAmount } from '../../../utils/numberParsing';
import { isEffectivelyZero, isWithinTolerance } from '../../../utils/numberComparison';
import { roundByMethod } from '../../../utils/rounding';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
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
} from '../../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../../data/offentligLoenTypes';
import { getKRLSatstabel, isKRLSatstabelId } from '../../../data/krlRates';
import { getStatistiskLoenudvikling } from '../../../data/statistiskeRates';
import { STORE_BEDEDAG_START } from '../../../config/indskudteLoentillaeg';
import { resolveAutoStoreBededagPct } from '../helpers/loenindkomstSatser';
import {
  buildFormulaText,
  computeFormulaValue,
  formatOverenskomstAmount,
  formatPercentCellFromRaw,
  mergeFeriepengeDisplay,
  parsePercentInput,
  resolveFeriePctForFormula,
  type FormulaComponents,
  type FormulaVisibility,
  wrapIndexFormulaAfterSlashWhenLong,
} from './reguleringFormulaUtils';
import { resolveOverenskomstCoverageStartIso, resolveOverenskomstEffectiveStartIso } from './reguleringCoverage';
import {
  buildPrivateOverenskomstFormulaComponents,
  resolvePrivateOverenskomstBaseContext,
} from './overenskomstReguleringShared';

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
const formatDateShort = formatISOToDanish;
const formatDateLong = formatIsoDateLong;

const isLoengruppe = (value: number): value is Loengruppe =>
  Number.isInteger(value) && value >= 0 && value <= 4;

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
};


const hasDefinedPctInput = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatDefinedPctInput = (value: number | undefined): string =>
  hasDefinedPctInput(value) ? formatPctFromInput(value) : '-';

const parseIsoDateToUtcDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  return parseISODate(iso) ?? null;
};

export const resolveTafDateBounds = (
  eoValues: ErstatningsopgoerelseValues,
  options?: Readonly<{ skadedatoISO?: ISODateString | undefined }>
): Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null => {
  const tafBounds = resolveTafConstraintBounds(eoValues, { skadedatoISO: options?.skadedatoISO });

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

export const resolveLoenudviklingSegmentBounds = (
  segments: readonly LoenudviklingSegment[]
): Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null => {
  let foerste: ISODateString | undefined;
  let sidste: ISODateString | undefined;

  for (const segment of segments) {
    foerste = foerste ? minISO(foerste, segment.fra) : segment.fra;
    sidste = sidste ? maxISO(sidste, segment.til) : segment.til;
  }

  if (!foerste || !sidste) return null;
  return { foerste, sidste };
};

export const resolveAnvendtReguleringsdato = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | undefined => resolveAnvendtReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
  beregningsperiodeTil: eoValues.tafBeregningsperiodeTil,
  skadedato: stamdataValues.skadedato,
});

/**
 * Producerer den kanoniske tekstbeskrivelse af løn-referencedatoen til brug i PDF.
 *
 * `anvendtReguleringsdato` er den kanoniske sandhed og beregnes via
 * `resolveAnvendtReguleringsdato`. Kaldestedet kan dog eksplicit markere, når
 * datoen repræsenterer beregningsperiodens implicitte slutdato, fordi den
 * sproglige formulering i EO skal være "opgjort frem til" og ikke "opgjort per".
 *
 * Teksten bliver "på skadedatoen" hvis `anvendtReguleringsdato` er lig `skadedato`
 * eller `undefined`; ellers "opgjort per [dato]" eller "opgjort frem til [dato]".
 */
export const resolveLoenSkadedatoText = (params: {
  subject: 'lønnen';
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
}): string => {
  const { subject, anvendtReguleringsdato, skadedato, useUntilWordingForImplicitBeregningsperiodeDate = false } = params;
  if (anvendtReguleringsdato && anvendtReguleringsdato !== skadedato) {
    const formatted = formatDateLong(anvendtReguleringsdato);
    if (formatted) {
      if (useUntilWordingForImplicitBeregningsperiodeDate) {
        return `${subject} opgjort frem til ${formatted}`;
      }
      return `${subject} opgjort per ${formatted}`;
    }
  }
  return `${subject} på skadedatoen`;
};

const formatIndexValue = (value: number): string =>
  formatAsAmount(value, 2);

const formatLoenudviklingFromIndex = (indexValue: number): string => {
  if (!Number.isFinite(indexValue)) return '';
  const delta = roundByMethod(indexValue - 100, 2, 'halfAwayFromZero');
  if (isEffectivelyZero(delta)) return '';
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
  const isSameNumericValue = isWithinTolerance(numeratorValue, denominatorValue);
  if (isSameNumericValue) {
    return numeratorDisplay;
  }
  const formula = isPlainValue
    ? `(${numeratorDisplay} / ${denominatorDisplay})`
    : `(${numeratorDisplay}) /\n(${denominatorDisplay})`;
  return wrapIndexFormulaAfterSlashWhenLong(formula, 90, !isPlainValue);
};

const resolveReguleringsvaerdierLoenHeader = (
  params: Readonly<{
    tafBeregningsenhed: TafBeregningsenhed;
    loenudviklingBeregningsgrundlag: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]['loenudviklingBeregningsgrundlag'];
    overenskomstId?: string | undefined;
  }>
): 'Timeløn' | 'Månedsløn' => {
  const { tafBeregningsenhed, loenudviklingBeregningsgrundlag, overenskomstId } = params;

  // Bevidst designafvigelse:
  // I reguleringstabellens overskrift skal overenskomst-sporet følge selve overenskomstens
  // `grundloenAngivetPer`, ikke de øvrige runtime-afledte visningsprincipper i EO.
  // Det er tilsigtet, fordi tabellen her dokumenterer kildedata for regulering, ikke den
  // beregnede præsentationsenhed fra andre flows. Hvis dette ændres, skal både EO-PDF og
  // EODebug vurderes samlet, da de deler denne builder.
  if (loenudviklingBeregningsgrundlag === 'Overenskomst' && overenskomstId) {
    const tafBeregnesSom = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(overenskomstId, tafBeregnesSom);
    if (grundloenAngivetPer === 'Time') return 'Timeløn';
    if (grundloenAngivetPer === 'Måned') return 'Månedsløn';
  }

  return tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? 'Timeløn' : 'Månedsløn';
};

const REGULERINGSVAERDIER_FRA_DATO_HEADER = 'Fra-dato';
const REGULERINGSVAERDIER_PENSION_HEADER = 'AG pens. bidrag';

const buildPlaceholderValueRow = (
  label: string,
  columns: readonly string[]
): string[] => [label, ...columns.slice(1).map(() => '-')];

const buildPlaceholderValueRowWithCells = (
  label: string,
  columns: readonly string[],
  cellValuesByHeader: Readonly<Record<string, string>>
): string[] => [
  label,
  ...columns.slice(1).map((header) => cellValuesByHeader[header] ?? '-'),
];

const resolveRelevantRealDatesForTafScope = (
  allDates: readonly ISODateString[],
  tafFra: ISODateString,
  tafTil: ISODateString
): readonly ISODateString[] => {
  if (allDates.length === 0) return [];
  let firstRelevant = allDates.filter((iso) => iso <= tafFra).at(-1);
  if (!firstRelevant) {
    firstRelevant = allDates.find((iso) => iso >= tafFra && iso <= tafTil);
  }
  if (!firstRelevant) return [];
  return allDates.filter((iso) => iso === firstRelevant || (iso >= tafFra && iso <= tafTil));
};

const resolveRelevantManualDatesForTafScope = (
  datedStarts: readonly ISODateString[],
  tafFra: ISODateString,
  tafTil: ISODateString,
  anvendtReguleringsdato: ISODateString | undefined
): readonly ISODateString[] => {
  const relevantRealDates = resolveRelevantRealDatesForTafScope(datedStarts, tafFra, tafTil);
  const hasExplicitStartForFirstCoveredTafPeriod = datedStarts.some((iso) => iso <= tafFra);
  const syntheticBaselineIso =
    !hasExplicitStartForFirstCoveredTafPeriod && !anvendtReguleringsdato
      ? tafFra
      : undefined;
  return sortIsoDates([
    ...relevantRealDates,
    ...(anvendtReguleringsdato ? [anvendtReguleringsdato] : []),
    ...(syntheticBaselineIso ? [syntheticBaselineIso] : []),
  ]);
};

type ManualRowStart = Readonly<{
  startIso: ISODateString;
  row: LoenudviklingManuelRow;
}>;

type ManualRowsContext = Readonly<{
  baseRow: LoenudviklingManuelRow;
  datedRowStarts: readonly ManualRowStart[];
}>;

const resolveManualRowsContext = (
  rows: readonly LoenudviklingManuelRow[]
): ManualRowsContext | null => {
  const baseRow = rows[0];
  if (!baseRow) return null;
  const datedRowStarts = rows
    .slice(1)
    .map((row) => {
      const startIso = parseDanishToISO(row.dato);
      return startIso ? { startIso, row } : null;
    })
    .filter((entry): entry is ManualRowStart => Boolean(entry))
    .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
  return { baseRow, datedRowStarts };
};

const findLatestManualRowForIso = (
  context: ManualRowsContext | null,
  iso: ISODateString
): LoenudviklingManuelRow | undefined => {
  if (!context) return undefined;
  let latest = context.baseRow;
  for (const entry of context.datedRowStarts) {
    if (entry.startIso > iso) break;
    latest = entry.row;
  }
  return latest;
};

const mergeConsecutiveValueRows = (
  rows: readonly string[][],
  options?: Readonly<{
    preserveFirstColumnValues?: ReadonlySet<string>;
  }>
): readonly string[][] => {
  if (rows.length <= 1) return rows;
  const preserveFirstColumnValues = options?.preserveFirstColumnValues;
  const merged: string[][] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    const hasSameValues = Boolean(
      last &&
      last.length === row.length &&
      last.slice(1).every((cell, index) => cell === row[index + 1])
    );
    // Hvis en eksplicit markeringsdato skal bevares, beskytter vi begge sider af grænsen.
    // Det sikrer, at hverken den markerede række eller den direkte nabo absorberes væk
    // i en identisk merge og dermed skjuler den brugerrelevante datolinje.
    const shouldPreserveBoundary = Boolean(
      preserveFirstColumnValues &&
      (preserveFirstColumnValues.has(last?.[0] ?? '') || preserveFirstColumnValues.has(row[0] ?? ''))
    );
    if (!hasSameValues || shouldPreserveBoundary) {
      merged.push(row);
    }
  }
  return merged;
};

const buildPreservedDateLabels = (
  anvendtReguleringsdato: ISODateString | undefined
): ReadonlySet<string> | undefined => {
  if (!anvendtReguleringsdato) return undefined;
  return new Set([formatDateShort(anvendtReguleringsdato)]);
};

const mergeConsecutiveRowsWithSameCalculation = (
  rows: readonly IndexRowWithIso[],
  options?: Readonly<{
    preserveStartIsos?: ReadonlySet<ISODateString>;
  }>
): readonly ReguleringIndexRow[] => {
  if (rows.length <= 1) return rows;
  const preserveStartIsos = options?.preserveStartIsos;
  const merged: IndexRowWithIso[] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    const isAdjacent = Boolean(last && getDayBeforeIso(row.fraIso) === last.tilIso);
    const hasSameCalculation = Boolean(last && last.signature === row.signature);
    const shouldPreserveBoundary = Boolean(
      preserveStartIsos &&
      (preserveStartIsos.has(last?.fraIso ?? row.fraIso) || preserveStartIsos.has(row.fraIso))
    );
    if (last && isAdjacent && hasSameCalculation && !shouldPreserveBoundary) {
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
  anvendtReguleringsdato: ISODateString | undefined;
  tafFra: ISODateString;
  tafTil: ISODateString;
  tafBeregningsenhed: TafBeregningsenhed;
}>): ReguleringValuesTableData | null => {
  const { ansaettelsesforhold, anvendtReguleringsdato, tafFra, tafTil, tafBeregningsenhed } = params;
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;

  if (grundlag === 'Overenskomst') {
    const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
    if (!overenskomstId) return null;
    const overenskomstCoverageStartIso = resolveOverenskomstCoverageStartIso(overenskomstId);
    if (!overenskomstCoverageStartIso) return null;
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

      const fraDato = isoToDanish(overenskomstCoverageStartIso);
      const tilDato = isoToDanish(tafTil);
      if (!fraDato || !tilDato) return null;
      assertOffentligReguleringsDatoGyldig(fraDato);
      const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';

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
      const showFeriePctColumn = !isEffectivelyZero(ansaettelsesforhold.feriePct);
      const showStoreBededagColumn = applyAlmindeligLoenPaaShDageRegel && tafTil >= STORE_BEDEDAG_START;
      const loenHeader = resolveReguleringsvaerdierLoenHeader({
        tafBeregningsenhed,
        loenudviklingBeregningsgrundlag: grundlag,
        overenskomstId,
      });
      const columns = [
        REGULERINGSVAERDIER_FRA_DATO_HEADER,
        loenHeader,
        ...(showFeriePctColumn ? ['Feriepenge'] : []),
        ...(hasShSo ? ['SH/SO'] : []),
        ...(hasFritvalg ? ['Fritvalg'] : []),
        ...(showStoreBededagColumn ? ['Store Bededag'] : []),
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
        ansaettelsesforhold.harAnciennitetstillaegEfterSkadedatoen &&
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
          ...(showStoreBededagColumn ? [formatPctFromInput(resolveAutoStoreBededagPct(ansaettelsesforhold, labelIso))] : []),
          ...(hasAgPension ? [formatPctFromInput(resolvePctPointFromSatsOrInput(tillaegSats?.agPension, ansaettelsesforhold.pensionPct))] : []),
        ]);
      };
      const allRealDates = new Set<ISODateString>();
      for (const entry of satser) {
        const iso = parseDanishToISO(entry.effectiveDate);
        if (!iso) continue;
        if (iso >= overenskomstCoverageStartIso && iso <= tafTil) allRealDates.add(iso);
      }
      for (const entry of tillaegsSatser) {
        const iso = parseDanishToISO(entry.fraDato);
        if (!iso) continue;
        if (iso >= overenskomstCoverageStartIso && iso <= tafTil) allRealDates.add(iso);
      }
      if (
        applyAlmindeligLoenPaaShDageRegel &&
        overenskomstCoverageStartIso < STORE_BEDEDAG_START &&
        tafTil >= STORE_BEDEDAG_START
      ) {
        allRealDates.add(STORE_BEDEDAG_START);
      }
      if (harAnciennitetstillaeg && anciennitetDatoIso && anciennitetDatoIso >= overenskomstCoverageStartIso && anciennitetDatoIso <= tafTil) {
        allRealDates.add(anciennitetDatoIso);
      }
      const relevantRealDates = resolveRelevantRealDatesForTafScope(
        sortIsoDates(allRealDates),
        tafFra,
        tafTil
      );
      if (relevantRealDates.length === 0) return null;
      const anvendtReguleringsdatoDa = anvendtReguleringsdato ? isoToDanish(anvendtReguleringsdato) : undefined;
      const includeAnvendtReguleringsdato = Boolean(
        anvendtReguleringsdato &&
        anvendtReguleringsdatoDa &&
        !getOffentligLoenForDato(offentligType, anvendtReguleringsdatoDa, loentrin, gruppeValue)
      );
      const finalDates = sortIsoDates(
        includeAnvendtReguleringsdato && anvendtReguleringsdato
          ? [...relevantRealDates, anvendtReguleringsdato]
          : relevantRealDates
      );
      for (const iso of finalDates) {
        const danish = isoToDanish(iso);
        if (!danish) continue;
        const loen = getOffentligLoenForDato(offentligType, danish, loentrin, gruppeValue);
        if (loen) {
          addRow(iso, loen.maanedsLoen, loen.timeLoen);
        } else if (anvendtReguleringsdato === iso) {
          rows.push(buildPlaceholderValueRow(formatDateShort(iso), columns));
        }
      }

      return {
        columns,
        rows: mergeConsecutiveValueRows(rows, {
          preserveFirstColumnValues: includeAnvendtReguleringsdato
            ? buildPreservedDateLabels(anvendtReguleringsdato)
            : undefined,
        }),
      };
    }

    const ref = resolveOverenskomstRef(overenskomstId);
    if (!ref) return null;
    const fraDato = isoToDanish(overenskomstCoverageStartIso);
    const tilDato = isoToDanish(tafTil);
    if (!fraDato || !tilDato) return null;

    const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
    const satser = getEffektiveSatserForPeriode({
      overenskomstId: ref.baseId,
      fraDato,
      tilDato,
      applyAlmindeligLoenPaaShDageRegel,
    });
    const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;
    const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null);
    const hasShSo = hasAnyPctSourceOrInput(allSatser, (sats) => sats.shSoSats, ansaettelsesforhold.shSoPct);
    const hasFritvalg = hasAnyPctSourceOrInput(allSatser, (sats) => sats.fritvalg, ansaettelsesforhold.fritvalgPct);
    const hasAgPension = hasAnyPctSourceOrInput(allSatser, (sats) => sats.agPension, ansaettelsesforhold.pensionPct);
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isEffectivelyZero(ansaettelsesforhold.feriePct);
    const showStoreBededagColumn = applyAlmindeligLoenPaaShDageRegel && tafTil >= STORE_BEDEDAG_START;
    const loenHeader = resolveReguleringsvaerdierLoenHeader({
      tafBeregningsenhed,
      loenudviklingBeregningsgrundlag: grundlag,
      overenskomstId,
    });
    const columns = [
      REGULERINGSVAERDIER_FRA_DATO_HEADER,
      ...(hasGrundloen ? [loenHeader] : []),
      ...(hasGrundloen && showFeriePctColumn ? ['Feriepenge'] : []),
      ...(hasShSo ? ['SH/SO'] : []),
      ...(hasFritvalg ? ['Fritvalg'] : []),
      ...(showStoreBededagColumn ? ['Store Bededag'] : []),
      ...(hasAgPension ? [REGULERINGSVAERDIER_PENSION_HEADER] : []),
    ] as const;
    const allRealDates = new Set<ISODateString>();
    for (const sats of satser) {
      const iso = parseDanishToISO(sats.fraDato);
      if (!iso) continue;
      if (iso >= overenskomstCoverageStartIso && iso <= tafTil) allRealDates.add(iso);
    }
    if (
      ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn' &&
      tafFra < STORE_BEDEDAG_START &&
      tafTil >= STORE_BEDEDAG_START
    ) {
      allRealDates.add(STORE_BEDEDAG_START);
    }

    const buildPrivateOverenskomstRow = (
      iso: ISODateString,
      danish: DanishDateString,
      displayDate: string
    ): string[] | null => {
      const sats = getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: danish,
        applyAlmindeligLoenPaaShDageRegel: ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn',
      });
      if (!sats) return null;
      const row: string[] = [displayDate];
      if (hasGrundloen) row.push(formatOverenskomstAmount(sats.grundloen));
      if (hasGrundloen && showFeriePctColumn) row.push(mergeFeriepengeDisplay(feriePctDisplay, undefined));
      if (hasShSo) row.push(formatPctFromInput(resolvePctPointFromSatsOrInput(sats.shSoSats, ansaettelsesforhold.shSoPct)));
      if (hasFritvalg) row.push(formatPctFromInput(resolvePctPointFromSatsOrInput(sats.fritvalg, ansaettelsesforhold.fritvalgPct)));
      if (showStoreBededagColumn) row.push(formatPctFromInput(resolveAutoStoreBededagPct(ansaettelsesforhold, iso)));
      if (hasAgPension) row.push(formatPctFromInput(resolvePctPointFromSatsOrInput(sats.agPension, ansaettelsesforhold.pensionPct)));
      return row;
    };
    const buildPrivatePlaceholderRow = (
      iso: ISODateString,
      displayDate: string
    ): string[] => buildPlaceholderValueRowWithCells(displayDate, columns, {
      ...(hasGrundloen && showFeriePctColumn ? { Feriepenge: mergeFeriepengeDisplay(feriePctDisplay, undefined) } : {}),
      ...(hasShSo ? { 'SH/SO': formatDefinedPctInput(ansaettelsesforhold.shSoPct) } : {}),
      ...(hasFritvalg ? { Fritvalg: formatDefinedPctInput(ansaettelsesforhold.fritvalgPct) } : {}),
      ...(showStoreBededagColumn ? { 'Store Bededag': formatPctFromInput(resolveAutoStoreBededagPct(ansaettelsesforhold, iso)) } : {}),
      ...(hasAgPension ? { [REGULERINGSVAERDIER_PENSION_HEADER]: formatDefinedPctInput(ansaettelsesforhold.pensionPct) } : {}),
    });
    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      sortIsoDates(allRealDates),
      tafFra,
      tafTil
    );
    if (relevantRealDates.length === 0) return null;
    const anvendtReguleringsdatoDa = anvendtReguleringsdato ? isoToDanish(anvendtReguleringsdato) : undefined;
    const includeAnvendtReguleringsdato = Boolean(
      anvendtReguleringsdato &&
      anvendtReguleringsdatoDa &&
      !getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: anvendtReguleringsdatoDa,
        applyAlmindeligLoenPaaShDageRegel,
      })
    );
    const finalDates = sortIsoDates(
      includeAnvendtReguleringsdato && anvendtReguleringsdato
        ? [...relevantRealDates, anvendtReguleringsdato]
        : relevantRealDates
    );
    const rows = finalDates
      .flatMap((iso) => {
        const danish = isoToDanish(iso);
        if (!danish) return [];
        const row = buildPrivateOverenskomstRow(iso, danish, danish);
        if (row) return [row];
        const isStoreBededagBeforeCoverage =
          showStoreBededagColumn &&
          applyAlmindeligLoenPaaShDageRegel &&
          iso === STORE_BEDEDAG_START &&
          iso < overenskomstCoverageStartIso;
        if (isStoreBededagBeforeCoverage) {
          return [buildPrivatePlaceholderRow(iso, danish)];
        }
        if (anvendtReguleringsdato === iso) {
          return [buildPrivatePlaceholderRow(iso, formatDateShort(iso))];
        }
        return [];
      });
    return {
      columns,
      rows: mergeConsecutiveValueRows(rows, {
        preserveFirstColumnValues: includeAnvendtReguleringsdato
          ? buildPreservedDateLabels(anvendtReguleringsdato)
          : undefined,
      }),
    };
  }

  if (grundlag === 'Manuelt angivet') {
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isEffectivelyZero(ansaettelsesforhold.feriePct);
    const hasStoreBededagPct = resolveAutoStoreBededagPct(ansaettelsesforhold, tafTil) > 0;
    const needsStoreBededagBoundaryRow = hasStoreBededagPct && tafFra < STORE_BEDEDAG_START && tafTil >= STORE_BEDEDAG_START;
    const manualRows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];
    const manualRowsContext = resolveManualRowsContext(manualRows);
    const datedStarts = sortIsoDates((manualRowsContext?.datedRowStarts ?? []).map((entry) => entry.startIso));
    const scopeDates = resolveRelevantManualDatesForTafScope(datedStarts, tafFra, tafTil, anvendtReguleringsdato);
    const normalizedRowsByIso = new Map<ISODateString, NonNullable<typeof manualRows>[number]>();
    for (const iso of scopeDates) {
      const row = findLatestManualRowForIso(manualRowsContext, iso);
      if (row) {
        normalizedRowsByIso.set(iso, row);
      }
    }
    const normalizedRows = Array.from(normalizedRowsByIso.entries())
      .map(([iso, row]) => ({ iso, row }))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1));

    if (needsStoreBededagBoundaryRow && !normalizedRows.some((entry) => entry.iso === STORE_BEDEDAG_START)) {
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
        ...(hasStoreBededagPct ? [formatPctFromInput(resolveAutoStoreBededagPct(ansaettelsesforhold, iso))] : []),
        formatPercentCellFromRaw(row.agPension)
      );
      return cells;
    });
    return {
      columns: [
        REGULERINGSVAERDIER_FRA_DATO_HEADER,
        resolveReguleringsvaerdierLoenHeader({
          tafBeregningsenhed,
          loenudviklingBeregningsgrundlag: grundlag,
          overenskomstId: undefined,
        }),
        'Feriepenge',
        'SH/SO',
        'Fritvalg',
        ...(hasStoreBededagPct ? ['Store Bededag'] : []),
        REGULERINGSVAERDIER_PENSION_HEADER,
      ],
      rows: mergeConsecutiveValueRows(rows, {
        preserveFirstColumnValues: buildPreservedDateLabels(anvendtReguleringsdato),
      }),
    };
  }

  if (grundlag === 'Statistik') {
    const modelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
    if (modelLabel === '') return null;

    if (isAslStatistikModel(modelLabel)) {
      const regDate = parseIsoDateToUtcDate(anvendtReguleringsdato);
      const tafFraDate = parseIsoDateToUtcDate(tafFra);
      const tafTilDate = parseIsoDateToUtcDate(tafTil);
      if (!regDate || !tafFraDate || !tafTilDate) return null;
      const startYear = tafFraDate.getUTCFullYear();
      const endYear = tafTilDate.getUTCFullYear();
      const years = new Set<number>([regDate.getUTCFullYear()]);
      for (let year = startYear; year <= endYear; year += 1) {
        years.add(year);
      }
      const rows: string[][] = Array.from(years)
        .sort((a, b) => a - b)
        .flatMap((year) => {
        const value = aarsloenAslMax[year as keyof typeof aarsloenAslMax];
          return typeof value === 'number' ? [[String(year), formatCurrency(value)]] : [];
        });
      if (rows.length !== years.size) return null;
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

    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      periodStarts.map((period) => period.startIso),
      tafFra,
      tafTil
    );
    if (relevantRealDates.length === 0) return null;
    const finalDates = sortIsoDates(
      anvendtReguleringsdato ? [...relevantRealDates, anvendtReguleringsdato] : relevantRealDates
    );
    const rows: string[][] = finalDates.flatMap((iso) => {
      const period = periodStarts.filter((entry) => entry.startIso <= iso).at(-1);
      if (!period && anvendtReguleringsdato === iso) {
        return [['-', formatDateShort(iso), '-']];
      }
      if (!period) return [];
      return [[period.kvartal, formatDateShort(iso), formatIndex(period.indeksvaerdi)]];
    });
    return { columns: ['Kvartal', 'Startdato', 'Indeksværdi'], rows: mergeConsecutiveValueRows(rows) };
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

    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      periodStarts.map((period) => period.startIso),
      tafFra,
      tafTil
    );
    if (relevantRealDates.length === 0) return null;
    const finalDates = sortIsoDates(
      anvendtReguleringsdato ? [...relevantRealDates, anvendtReguleringsdato] : relevantRealDates
    );
    const rows: string[][] = finalDates.flatMap((iso) => {
      const period = periodStarts.filter((entry) => entry.startIso <= iso).at(-1);
      if (!period && anvendtReguleringsdato === iso) {
        return [[formatDateShort(iso), '-']];
      }
      if (!period) return [];
      return [[formatDateShort(iso), formatKrlPct(period.reguleringsPct)]];
    });
    return {
      columns: ['Fra-dato', 'Reguleringsprocent'],
      rows: mergeConsecutiveValueRows(rows, {
        preserveFirstColumnValues: buildPreservedDateLabels(anvendtReguleringsdato),
      }),
    };
  }

  return null;
};

export const buildReguleringIndexRows = (params: Readonly<{
  segments: readonly LoenudviklingSegment[];
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  anvendtReguleringsdato: ISODateString | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
}>): readonly ReguleringIndexRow[] => {
  const { segments, ansaettelsesforhold, anvendtReguleringsdato, tafBeregningsenhed } = params;
  if (segments.length === 0) return [];
  const tafStartIso = segments[0].fra;
  const tafEndIso = segments[segments.length - 1].til;
  const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
  const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
  const getStoreBededagPct = (iso: ISODateString): number =>
    resolveAutoStoreBededagPct(ansaettelsesforhold, iso);
  const statistikModelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
  const isStatistik = loenudviklingBasis === 'Statistik';
  const isKRL = loenudviklingBasis === 'KRL satstabel';
  const isSimpleIndex = isStatistik || isKRL;
  const preserveBoundaryStartIsos = (() => {
    const shouldPreserveStoreBededagBoundary =
      tafStartIso < STORE_BEDEDAG_START &&
      tafEndIso >= STORE_BEDEDAG_START &&
      (
        (loenudviklingBasis === 'Overenskomst' && applyAlmindeligLoenPaaShDageRegel) ||
        (loenudviklingBasis === 'Manuelt angivet' && applyAlmindeligLoenPaaShDageRegel)
      );
    if (!shouldPreserveStoreBededagBoundary) return undefined;
    return new Set<ISODateString>([STORE_BEDEDAG_START]);
  })();
  const finalizeIndexRows = (rows: readonly IndexRowWithIso[]): readonly ReguleringIndexRow[] =>
    mergeConsecutiveRowsWithSameCalculation(rows, { preserveStartIsos: preserveBoundaryStartIsos });
  const manualRowsContext = loenudviklingBasis === 'Manuelt angivet'
    ? resolveManualRowsContext(ansaettelsesforhold.loenudviklingManuelTableData ?? [])
    : null;
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
      const leftTil = getDayBeforeIso(boundaryIso);
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
    if (!ansaettelsesforhold.overenskomstId || !ansaettelsesforhold.harAnciennitetstillaegEfterSkadedatoen) return null;
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
    anvendtReguleringsdato &&
    ansaettelsesforhold.overenskomstId
  ) {
    const effectiveReguleringsdato = resolveOverenskomstEffectiveStartIso(ansaettelsesforhold.overenskomstId, anvendtReguleringsdato);
    const fallbackRowWithIso = (segment: LoenudviklingSegment): IndexRowWithIso => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const indeksberegning = isWithinTolerance(indeksValue, 100) ? '100,00' : `${indeksDisplay} / 100,00`;
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
        return finalizeIndexRows(segments.map(fallbackRowWithIso));
      }
      assertOffentligReguleringsDatoGyldig(baseDato);
      if (!isLoengruppe(gruppeValue)) {
        return finalizeIndexRows(segments.map(fallbackRowWithIso));
      }
      let loentrin: ReturnType<typeof toLoentrin>;
      try {
        loentrin = toLoentrin(trinValue);
      } catch {
        return finalizeIndexRows(segments.map(fallbackRowWithIso));
      }

      const baseResult = getOffentligLoenForDato(offentligType, baseDato, loentrin, gruppeValue);
      if (!baseResult) return finalizeIndexRows(segments.map(fallbackRowWithIso));
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
        (anvendtReguleringsdato >= STORE_BEDEDAG_START || segmentsForOverenskomstCalc.some((segment) => segment.til >= STORE_BEDEDAG_START));
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
        storeBededagPct: getStoreBededagPct(anvendtReguleringsdato),
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
      return finalizeIndexRows(rows);
    }

    const ref = resolveOverenskomstRef(ansaettelsesforhold.overenskomstId);
    const effectiveBaseDato = isoToDanish(effectiveReguleringsdato);
    if (ref && effectiveBaseDato) {
      const privateBaseContext = resolvePrivateOverenskomstBaseContext({
        overenskomstId: ref.baseId,
        anvendtReguleringsdato,
        effectiveReguleringsdato,
        applyAlmindeligLoenPaaShDageRegel,
        shSoPctInput: ansaettelsesforhold.shSoPct,
        fritvalgPctInput: ansaettelsesforhold.fritvalgPct,
        pensionPctInput: ansaettelsesforhold.pensionPct,
      });
      if (privateBaseContext) {
        const allSatser = getOverenskomst(ref.baseId)?.satser ?? [];
        const hasShSo =
          hasAnyPctSourceOrInput(allSatser, (sats) => sats.shSoSats, ansaettelsesforhold.shSoPct);
        const hasFritvalg =
          hasAnyPctSourceOrInput(allSatser, (sats) => sats.fritvalg, ansaettelsesforhold.fritvalgPct);
        const hasAgPension =
          hasAnyPctSourceOrInput(allSatser, (sats) => sats.agPension, ansaettelsesforhold.pensionPct);
        const firstSegmentStartIso = segmentsForOverenskomstCalc[0]?.fra ?? segments[0]?.fra;
        const lastSegmentEndIso = segmentsForOverenskomstCalc[segmentsForOverenskomstCalc.length - 1]?.til ?? segments[segments.length - 1]?.til;
        const hasStoreBededagPerioder = Boolean(
          firstSegmentStartIso &&
          lastSegmentEndIso &&
          applyAlmindeligLoenPaaShDageRegel &&
          lastSegmentEndIso >= STORE_BEDEDAG_START
        );
        const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
        const baseAnciennitet = anciennitetForIndex && effectiveReguleringsdato >= anciennitetForIndex.activeFromIso
          ? anciennitetForIndex.supplementValue
          : 0;
        const baseComponents: FormulaComponents = buildPrivateOverenskomstFormulaComponents({
          sats: privateBaseContext.effectiveBase.sats,
          context: privateBaseContext,
          feriePct,
          shSoPctInput: ansaettelsesforhold.shSoPct,
          fritvalgPctInput: ansaettelsesforhold.fritvalgPct,
          pensionPctInput: ansaettelsesforhold.pensionPct,
          pctBasisRole: 'reference',
          dateIso: anvendtReguleringsdato,
          baseValueSupplement: baseAnciennitet,
          applyAlmindeligLoenPaaShDageRegel,
        });
        const baseVisibility: FormulaVisibility = {
          showFritvalg: hasFritvalg,
          showShSo: hasShSo,
          showPension: hasAgPension,
          showStoreBededag: getStoreBededagPct(effectiveReguleringsdato) > 0 || hasStoreBededagPerioder,
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

          const useStoreBededagOnlyBeforeCoverage =
            applyAlmindeligLoenPaaShDageRegel &&
            segment.fra >= STORE_BEDEDAG_START &&
            segment.fra < privateBaseContext.effectiveBase.startIso;

          if (!sats && !useStoreBededagOnlyBeforeCoverage) {
            return fallbackRowWithIso(segment);
          }

          const effectiveSats = sats ?? privateBaseContext.effectiveBase.sats;
          const segmentAnciennitet = anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso
            ? anciennitetForIndex.supplementValue
            : 0;
          const components: FormulaComponents = buildPrivateOverenskomstFormulaComponents({
            sats: effectiveSats,
            context: privateBaseContext,
            feriePct,
            shSoPctInput: ansaettelsesforhold.shSoPct,
            fritvalgPctInput: ansaettelsesforhold.fritvalgPct,
            pensionPctInput: ansaettelsesforhold.pensionPct,
            pctBasisRole: useStoreBededagOnlyBeforeCoverage ? 'reference' : 'segment',
            dateIso: segment.fra,
            baseValueSupplement: segmentAnciennitet,
            applyAlmindeligLoenPaaShDageRegel,
          });
          const visibility: FormulaVisibility = {
            showFritvalg: hasFritvalg,
            showShSo: hasShSo,
            showPension: hasAgPension,
            showStoreBededag: getStoreBededagPct(effectiveReguleringsdato) > 0 || hasStoreBededagPerioder,
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
        return finalizeIndexRows(rows);
      }
    }
  }

  const baseIndex = (() => {
    if (!anvendtReguleringsdato) return null;
    if (loenudviklingBasis === 'Manuelt angivet') {
      const baseRow = findLatestManualRowForIso(manualRowsContext, anvendtReguleringsdato);
      if (!baseRow) return null;
      return {
        components: {
          baseValue: parseAmount(baseRow?.grundloen),
          feriePct: resolveFeriePctForFormula(baseRow?.feriepenge, ansaettelsesforhold.feriePct),
          fritvalgPct: parsePercentInput(baseRow?.fritvalg),
          shSoPct: parsePercentInput(baseRow?.shSoSats),
          pensionPct: parsePercentInput(baseRow?.agPension),
          storeBededagPct: getStoreBededagPct(anvendtReguleringsdato),
        },
        visibility: {
          showFritvalg: true,
          showShSo: true,
          showPension: true,
          showStoreBededag: getStoreBededagPct(anvendtReguleringsdato) > 0,
        },
      };
    }
    if (loenudviklingBasis === 'Statistik') {
      if (statistikModelLabel === '') return null;
      if (isAslModel) {
        const regDate = parseIsoDateToUtcDate(anvendtReguleringsdato);
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
        if (period.startIso > anvendtReguleringsdato) break;
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
        if (period.startIso > anvendtReguleringsdato) break;
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
      const baseRow = findLatestManualRowForIso(manualRowsContext, tafStartIso);
      if (!baseRow) return [];
      const datedRowStarts = manualRowsContext?.datedRowStarts ?? [];
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
        ...datedRowStarts
          .filter(({ startIso }) => startIso >= tafStartIso && startIso <= tafEndIso)
          .map(({ startIso, row }) => {
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

      const hasStoreBededagPerioder = applyAlmindeligLoenPaaShDageRegel && tafEndIso >= STORE_BEDEDAG_START;

      if (hasStoreBededagPerioder && tafStartIso < STORE_BEDEDAG_START) {
        const baseForStore = [...periodStarts]
          .filter((period) => period.startIso <= STORE_BEDEDAG_START)
          .sort((a, b) => (a.startIso < b.startIso ? 1 : -1))[0];
        if (baseForStore && !periodStarts.some((p) => p.startIso === STORE_BEDEDAG_START)) {
          periodStarts.push({
            startIso: STORE_BEDEDAG_START,
            components: {
              ...baseForStore.components,
              storeBededagPct: getStoreBededagPct(STORE_BEDEDAG_START),
            },
          });
        }
      }
      if (hasStoreBededagPerioder) {
        const updated = periodStarts.map((period) => {
          return {
            ...period,
            components: {
              ...period.components,
              storeBededagPct: getStoreBededagPct(period.startIso),
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
          showStoreBededag: hasStoreBededagPerioder || (anvendtReguleringsdato ? getStoreBededagPct(anvendtReguleringsdato) > 0 : false),
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
          if (typeof value !== 'number') return [];
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
    return finalizeIndexRows(segments.map((segment) => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const formulaText = isWithinTolerance(indeksValue, 100) ? '100,00' : `${indeksDisplay} / 100,00`;
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

  return finalizeIndexRows(segments.map((segment) => {
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
