import type { ISODateString } from '../../../types/branded';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { LoenudviklingSegment } from '../shared/eoTypes';
import { getAngivetLoenOpreguleresFraDato } from '../helpers/angivetLoenHelpers';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import { clampTafRow, resolveTafConstraintBounds } from '../validation/tafPeriodConstraints';
import { getDayBeforeIso, maxISO, minISO } from '../../../utils/isoDateHelpers';
import {
  formatAmountWithoutTrailingDecimals,
  resolveAnvendtReguleringsdato as resolveAnvendtReguleringsdatoShared,
  isAslStatistikModel,
  resolveStatistikModelId,
} from '../helpers/eoSharedUtils';
import { resolveLoenReferencedatoText } from '../helpers/eoDateReferenceText';
import { formatAsAmount, formatCurrency, formatPercent as formatPercentUtil } from '../../../utils/formatUtils';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { isEffectivelyZero, isWithinTolerance } from '../../../utils/numberComparison';
import { getGrundloenAngivetPerForOverenskomst } from '../../../data/overenskomstRates';
import { isKRLSatstabelId } from '../../../data/krlRates';
import { STORE_BEDEDAG_START } from '../../../data/indskudteLoentillaeg';
import {
  buildFormulaText, formatPercentCellFromRaw,
  type FormulaComponents, type FormulaVisibility, wrapIndexFormulaAfterSlashWhenLong,
} from './reguleringFormulaUtils';
import type { ReguleringForloeb } from './reguleringForloeb';
import { findLatestByDateInSortedList } from './reguleringSeriesLookup';

export type ReguleringIndexRow = Readonly<{
  fraDato: string;
  tilDato: string;
  indeksberegning: string;
  indeks: string;
  loenudvikling: string;
  // KL-lønaftaler: den kæde-opregulerede, afrundede måneds-/dagsløn for perioden.
  // Kun udfyldt for KL-lønaftaler – øvrige modeller lader den være undefined.
  reguleretLoen?: string;
}>;

export type ReguleringValuesTableData = Readonly<{
  columns: readonly string[];
  /**
   * Rækkerne dækker de satser, der indgår i reguleringen: basisrækken (satsen i kraft på den anvendte
   * reguleringsdato – formlens nævner i "Beregnet regulering"), satsen ved reguleringsvinduets start
   * og hver satsændring frem til slut. Basisrækken vises kun, når dens værdier ikke i forvejen fremgår
   * af de øvrige rækker, og dateres med sin RÅ satsdato fra reguleringsgrundlaget – aldrig med selve
   * reguleringsdatoen (ingen syntetisk reguleringsdato-række). Mellemliggende satsændringer mellem
   * basis og vinduet, som ingen beregning bruger, medtages ikke (jf. "vist = beregnet").
   */
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /**
   * Sat når reguleringskilden ikke har nogen registreret sats på/før reguleringsdatoen, og
   * tabellen derfor tager afsæt i den tidligste registrerede sats (pr. denne dato). Renderlaget
   * viser i så fald en forklarende note. Udeladt i det normale tilfælde, hvor der findes en sats
   * på/før reguleringsdatoen.
   */
  tidligsteSatsGaelderFra?: ISODateString;
}>;

type IndexRowWithIso = ReguleringIndexRow & Readonly<{
  fraIso: ISODateString;
  tilIso: ISODateString;
  signature: string;
}>;

export const resolveStatistikModelIdFromLabel = resolveStatistikModelId;
const formatDateShort = formatISOToDanish;
const formatPctFromInput = (value: number | undefined): string => formatPercentUtil(value ?? 0);

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

/**
 * Kanonisk opslag af de beregnede lønudviklingssegmenter for ét renderet
 * ansættelsesforhold (kilden kommer fra `resolveLoenudviklingKilde`).
 *
 * `perAnsaettelse` er kun udfyldt ved `beregnesUdFra === 'Beregningsperiode'`, hvor
 * hvert ansættelsesforhold har sit eget reguleringsforløb. Ved angivet løn er
 * `perAnsaettelse` tom, og hele forløbet ligger i de globale `beregnedeSegmenter`
 * (kilden er ét syntetisk EO-ansættelsesforhold). Uden global-fallback her ville
 * "Beregnet regulering"-tabellen mangle for angivet løn, selvom forløbet faktisk
 * er beregnet og vises korrekt under "Forventet indkomst".
 *
 * Følger samme global-fallback-princip som `buildSfggLoenudviklingMap`
 * (tafNettoBeregning.ts): per-ansættelse når den findes, ellers de delte globale
 * segmenter for enkelt-kilde-modeller. Ved en reel per-ansættelse-model uden match
 * (fx et ansættelsesforhold uden indkomst i beregningsperioden) returneres tomt,
 * så et urelateret forløb ikke fejlagtigt vises.
 */
export const resolveLoenudviklingSegmenterForKilde = (
  params: Readonly<{
    perAnsaettelse: readonly Readonly<{
      ansaettelsesforholdId: string;
      beregnedeSegmenter: readonly LoenudviklingSegment[];
    }>[];
    globaleSegmenter: readonly LoenudviklingSegment[];
    ansaettelsesforholdId: string;
  }>
): readonly LoenudviklingSegment[] => {
  const { perAnsaettelse, globaleSegmenter, ansaettelsesforholdId } = params;
  const match = perAnsaettelse.find((entry) => entry.ansaettelsesforholdId === ansaettelsesforholdId);
  if (match) return match.beregnedeSegmenter;
  return perAnsaettelse.length === 0 ? globaleSegmenter : [];
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
 * `resolveAnvendtReguleringsdato`; teksten navngiver derefter den konkrete
 * brugerforståelige kilde til datoen.
 *
 * Teksten bliver fx "på skadedatoen (01-01-2024)", "ved beregningsperiodens
 * udløb (31-12-2024)" eller "på den manuelt angivne reguleringsdato
 * (15-03-2024)".
 */
export const resolveLoenSkadedatoText = (params: {
  subject: 'lønnen';
  anvendtReguleringsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  skadestype: StamdataValues['skadestype'] | undefined;
  beregnesUdFra?: ErstatningsopgoerelseValues['beregnesUdFra'] | undefined;
  beregningsperiodeTil?: ISODateString | undefined;
  saerligFraDatoRegulering?: ISODateString | undefined;
  angivetLoenMetodeOpreguleresFraDato?: ISODateString | undefined;
  useUntilWordingForImplicitBeregningsperiodeDate?: boolean;
}): string => resolveLoenReferencedatoText(params);

const formatIndexValue = (value: number): string =>
  formatAsAmount(value, 2);

// KRL-satstabellens reguleringsprocent vises med 4 decimaler (kildens egen præcision), modsat
// indeks/øvrige procenter (2 dec.). Navngivet så decimalantallet ikke driver ved en fremtidig ændring.
const KRL_REGULERING_PCT_DECIMALS = 4;

const formatManuelProcentsatsAkkumuleretPct = (value: number): string => {
  const sign = value >= 0 ? '+ ' : '- ';
  // Altid to decimaler (også ",00") – procentværdierne i Reguleringsværdier-tabellen vises fast med to decimaler.
  return `${sign}${formatAsAmount(Math.abs(value), 2)} %`;
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
  // EOInspektion vurderes samlet, da de deler denne builder.
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

/**
 * Kolonneoverskriften for feriesatsen. Kolonnen indeholder en PROCENTSATS, og en sats navngives med den
 * konkrete ydelse – ikke med fællesbetegnelsen «Feriepenge», som den hed før
 * (`feriepenge-begreber-contract.md` §2a).
 *
 * Konstanten findes, fordi navnet bruges FIRE steder: tre overskriftslister og som nøgle i
 * placeholder-rækkens celleobjekt, der slår op på netop overskriftsnavnet. Højrejusteringen i UI og PDF
 * matcher desuden på strengen (`regulationTableColumns.ts`, `reguleringSection.ts`), så et navn skrevet
 * i hånden fire steder ville miste justeringen, så snart ét af dem blev rettet.
 */
export const REGULERINGSVAERDIER_FERIE_HEADER = 'Feriegodtg./-till.';

/**
 * Afgør, om Reguleringsværdier-tabellen skal ledsages af en note om, at kilden ikke har satser
 * på/før reguleringsdatoen. Noten sættes kun, når kildens tidligste registrerede sats først gælder
 * EFTER reguleringsdatoen – dvs. reguleringen tager afsæt i en senere sats, fordi der ingen findes
 * på reguleringsdatoen.
 *
 * VIGTIGT: `kildeTidligsteSatsIso` SKAL være kildens reelle, *uscopede* tidligste satsdato (kildens
 * coverage-`fraDato`), ikke en TAF-vindue-scopet delmængde som `relevantRealDates[0]`. Noten er en
 * påstand om selve reguleringsgrundlaget ("indeholder ingen satser før X"); bruger man den scopede
 * første række, hævder noten fejlagtigt manglende ældre satser, når en satsændring ligger mellem
 * reguleringsdatoen og TAF-periodens start. Genindfør derfor ALDRIG `relevantRealDates[0]` her.
 */
const resolveTidligsteSatsGaelderFra = (
  kildeTidligsteSatsIso: ISODateString | undefined,
  anvendtReguleringsdato: ISODateString | undefined
): ISODateString | undefined =>
  kildeTidligsteSatsIso && anvendtReguleringsdato && kildeTidligsteSatsIso > anvendtReguleringsdato
    ? kildeTidligsteSatsIso
    : undefined;

const resolveRelevantRealDatesForTafScope = (
  allDates: readonly ISODateString[],
  tafFra: ISODateString,
  tafTil: ISODateString,
  // Basisanker: den anvendte reguleringsdato. Når sat, medtages ekstra den sats, der var i kraft
  // PÅ reguleringsdatoen (seneste satsdato på/før ankeret) – dvs. selve reguleringsgrundlaget, som
  // "Beregnet regulering" dividerer med (indeks-100-niveauet). Uden den mangler basisrækken i
  // tabellen, når satsen ændrede sig mellem reguleringsdatoen og reguleringsvinduets start, og
  // læseren kan ikke genfinde formlens nævner. Ligger den i kraft værende sats allerede i det
  // viste vindue (samme satsdato som `firstRelevant` eller inde i [tafFra, tafTil]), tilføjer den
  // intet – dubletter fjernes af filteret nedenfor, og en identisk nabo flettes af
  // `mergeConsecutiveValueRows`. Satsrækken dateres med sin RÅ satsdato fra reguleringsgrundlaget,
  // ikke med reguleringsdatoen (ingen syntetisk reguleringsdato-række).
  baseAnchorIso?: ISODateString
): readonly ISODateString[] => {
  if (allDates.length === 0) return [];
  let firstRelevant = allDates.filter((iso) => iso <= tafFra).at(-1);
  if (!firstRelevant) {
    firstRelevant = allDates.find((iso) => iso >= tafFra && iso <= tafTil);
  }
  if (!firstRelevant) return [];
  const baseRelevant = baseAnchorIso
    ? allDates.filter((iso) => iso <= baseAnchorIso).at(-1)
    : undefined;
  return allDates.filter(
    (iso) =>
      iso === firstRelevant ||
      (baseRelevant !== undefined && iso === baseRelevant) ||
      (iso >= tafFra && iso <= tafTil)
  );
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

/** Satsrækkerne viser præcis motorens reference- og periodekomponenter. */
const buildEvaluatedPackageTable = (params: Readonly<{
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  anvendtReguleringsdato: ISODateString | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
  segments?: readonly LoenudviklingSegment[];
}>): ReguleringValuesTableData | null => {
  const entries = new Map<ISODateString, Readonly<{
    components: FormulaComponents; wageBaseValue?: number; wageSupplement?: number;
  }>>();
  for (const segment of params.segments ?? []) {
    const bevis = segment.regulering;
    if (!bevis?.referenceComponents || !bevis.periodComponents) continue;
    if (bevis.referenceDate) entries.set(bevis.referenceDate, { components: bevis.referenceComponents, wageBaseValue: bevis.referenceWageBaseValue, wageSupplement: bevis.referenceWageSupplement });
    if (bevis.periodRateDate) entries.set(bevis.periodRateDate, { components: bevis.periodComponents, wageBaseValue: bevis.wageBaseValue, wageSupplement: bevis.wageSupplement });
  }
  if (entries.size === 0) return null;
  const rows = [...entries].sort(([a], [b]) => a.localeCompare(b));
  // Kildens kolonner bevares, også når fx SH-satsen aktuelt er 0 ved almindelig løn på helligdage.
  // Kolonnevalget er producentmetadata; visningen må ikke genindlæse overenskomstens satser.
  const sourceColumns = new Set<keyof FormulaComponents>((params.segments ?? []).flatMap(
    (segment) => segment.regulering?.sourceColumns ?? []
  ));
  const show = (key: keyof FormulaComponents) => sourceColumns.has(key)
    || rows.some(([, value]) => !isEffectivelyZero(value.components[key]));
  const percentageColumns = [
    ['feriePct', REGULERINGSVAERDIER_FERIE_HEADER], ['shSoPct', 'SH/SO'],
    ['fritvalgPct', 'Fritvalg'], ['storeBededagPct', 'Store Bededag'],
    ['pensionPct', REGULERINGSVAERDIER_PENSION_HEADER],
  ] as const;
  const visibleColumns = percentageColumns.filter(([key]) => show(key));
  const firstDate = rows[0][0];
  return {
    columns: [REGULERINGSVAERDIER_FRA_DATO_HEADER, resolveReguleringsvaerdierLoenHeader({
      tafBeregningsenhed: params.tafBeregningsenhed,
      loenudviklingBeregningsgrundlag: params.ansaettelsesforhold.loenudviklingBeregningsgrundlag,
      overenskomstId: params.ansaettelsesforhold.overenskomstId,
    }), ...visibleColumns.map(([, label]) => label)],
    rows: mergeConsecutiveValueRows(rows.map(([date, { components, wageBaseValue, wageSupplement }]) => [
      formatDateShort(date), wageSupplement !== undefined && wageSupplement > 0 && wageBaseValue !== undefined
        ? `${formatCurrency(wageBaseValue)} (+ ${formatAmountWithoutTrailingDecimals(wageSupplement)} kr.)`
        : formatCurrency(components.baseValue),
      ...visibleColumns.map(([key]) => params.ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Manuelt angivet' && key !== 'storeBededagPct'
        ? formatPercentCellFromRaw(components[key]) : formatPctFromInput(components[key])),
    ]), { preserveFirstColumnValues: buildPreservedDateLabels(params.anvendtReguleringsdato) }),
    tidligsteSatsGaelderFra: resolveTidligsteSatsGaelderFra(firstDate, params.anvendtReguleringsdato),
  };
};

export const buildReguleringsvaerdierTableData = (params: Readonly<{
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  anvendtReguleringsdato: ISODateString | undefined;
  tafFra: ISODateString;
  tafTil: ISODateString;
  tafBeregningsenhed: TafBeregningsenhed;
  segments?: readonly LoenudviklingSegment[];
  // Motorens autoritative kildeserie. Både dokument- og kontrolprojektionen modtager samme model;
  // manglende serie fail-closer den pågældende tabel frem for at genindlæse rå kildedata.
  forloeb?: ReguleringForloeb;
}>): ReguleringValuesTableData | null => {
  const { ansaettelsesforhold, anvendtReguleringsdato, tafFra, tafTil, forloeb } = params;
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;

  if (grundlag === 'Overenskomst' || grundlag === 'Manuelt angivet') {
    return buildEvaluatedPackageTable(params);
  }

  if (grundlag === 'Manuel procentsats') {
    const entries = forloeb?.kind === 'manuelProcentsats' ? forloeb.entries : [];
    const relevantRows = entries.filter((entry) => entry.isBase || entry.startIso <= tafTil);
    if (relevantRows.length === 0) return null;
    return {
      columns: ['Dato', 'Procent', 'Indeks', 'Akkumuleret'],
      rows: relevantRows.map((entry) => [
        formatDateShort(entry.startIso),
        // Fast to decimaler (også ",00") på procentkolonnen.
        `${formatAsAmount(entry.procent, 2)} %`,
        formatIndexValue(entry.anvendtIndeks),
        formatManuelProcentsatsAkkumuleretPct(entry.anvendtPct),
      ]),
    };
  }

  if (grundlag === 'Statistik') {
    const modelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
    if (modelLabel === '') return null;

    if (isAslStatistikModel(modelLabel)) {
      const values = new Map<string, number>();
      for (const segment of params.segments ?? []) {
        const bevis = segment.regulering;
        if (bevis?.sourceKind !== 'asl') return null;
        if (bevis.referenceDate) values.set(bevis.referenceDate.slice(0, 4), bevis.referenceValue);
        if (bevis.periodRateDate) values.set(bevis.periodRateDate.slice(0, 4), bevis.periodValue);
      }
      if (values.size === 0) return null;
      return {
        columns: ['År', 'Maksimum årsløn'],
        rows: [...values].sort(([a], [b]) => a.localeCompare(b))
          .map(([year, value]) => [year, formatCurrency(value)]),
      };
    }

    const modelId = resolveStatistikModelIdFromLabel(modelLabel);
    if (!modelId) return null;
    // Statistik-kvartalsserien kommer udelukkende fra motorens forløb.
    const periodStarts = forloeb?.kind === 'statistik' ? forloeb.entries : [];
    if (periodStarts.length === 0) return null;

    const decimals = forloeb?.kind === 'statistik' ? forloeb.displayDecimals : 2;
    const formatIndex = (value: number) =>
      formatAsAmount(value, decimals);

    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      periodStarts.map((period) => period.startIso),
      tafFra,
      tafTil,
      anvendtReguleringsdato
    );
    if (relevantRealDates.length === 0) return null;
    // Basisankeret medtager indeksperioden i kraft på reguleringsdatoen (formlens nævner), hvis den
    // ikke allerede indgår. Ingen syntetisk reguleringsdato-række; tabellen viser indeksperioden ved
    // reguleringsvinduets start og hver efterfølgende periode. Findes ingen periode på/før
    // reguleringsdatoen, viser tabellen den tidligste kendte periode og ledsages af en note.
    const rows: string[][] = relevantRealDates.flatMap((iso) => {
      const period = findLatestByDateInSortedList(periodStarts, iso, 'statistik:presentation');
      if (!period) return [];
      return [[period.kvartal, formatDateShort(iso), formatIndex(period.indeksvaerdi)]];
    });
    return {
      columns: ['Kvartal', 'Startdato', 'Indeksværdi'],
      rows: mergeConsecutiveValueRows(rows),
      // Kildens uscopede tidligste periode (periodStarts er sorteret stigende), IKKE relevantRealDates[0].
      tidligsteSatsGaelderFra: resolveTidligsteSatsGaelderFra(periodStarts[0].startIso, anvendtReguleringsdato),
    };
  }

  if (grundlag === 'KRL satstabel') {
    const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
    if (!krlId || !isKRLSatstabelId(krlId)) return null;

    const formatKrlPct = (value: number): string =>
      formatAsAmount(value, KRL_REGULERING_PCT_DECIMALS) + ' %';

    // KRL-periodeserien kommer udelukkende fra motorens forløb.
    const periodStarts = forloeb?.kind === 'krl' ? forloeb.entries : [];
    if (periodStarts.length === 0) return null;

    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      periodStarts.map((period) => period.startIso),
      tafFra,
      tafTil,
      anvendtReguleringsdato
    );
    if (relevantRealDates.length === 0) return null;
    // Basisankeret medtager reguleringsprocenten i kraft på reguleringsdatoen (formlens nævner), hvis
    // den ikke allerede indgår. Ingen syntetisk reguleringsdato-række; tabellen viser
    // reguleringsprocenten ved reguleringsvinduets start og hver efterfølgende ændring. Findes ingen
    // sats på/før reguleringsdatoen, viser tabellen den tidligste kendte sats og ledsages af en note.
    const rows: string[][] = relevantRealDates.flatMap((iso) => {
      const period = findLatestByDateInSortedList(periodStarts, iso, 'krl:presentation');
      if (!period) return [];
      return [[formatDateShort(iso), formatKrlPct(period.reguleringsPct)]];
    });
    return {
      columns: ['Fra-dato', 'Reguleringsprocent'],
      rows: mergeConsecutiveValueRows(rows),
      // Kildens uscopede tidligste sats (periodStarts er sorteret stigende), IKKE relevantRealDates[0].
      tidligsteSatsGaelderFra: resolveTidligsteSatsGaelderFra(periodStarts[0].startIso, anvendtReguleringsdato),
    };
  }

  if (grundlag === 'KL-lønaftaler') {
    // KL-lønaftaler vises som periode-reguleringssats (kilde-værdien). Der vises bevidst
    // ingen akkumuleret regulering – KL-lønaftaler-modellen kender ikke akkumuleret regulering;
    // reguleringen sker trinvist på lønnen (jf. "Beregnet regulering"-tabellen og
    // docs/domain/taf/kl-loenaftaler-regulering.md).
    const formatKlPct = (value: number): string =>
      `${formatAsAmount(value, 2)} %`;

    // KL-periodeserien kommer udelukkende fra motorens forløb. Den viste
    // reguleringssats er nu samme kilde som de brudpunkter beløbet bygger på.
    const periodStarts = forloeb?.kind === 'klLoenaftaler' ? forloeb.entries : [];
    if (periodStarts.length === 0) return null;

    const relevantRealDates = resolveRelevantRealDatesForTafScope(
      periodStarts.map((period) => period.startIso),
      tafFra,
      tafTil
    );
    if (relevantRealDates.length === 0) return null;
    // Ingen syntetisk reguleringsdato-række; tabellen viser reguleringssatsen ved reguleringsvinduets
    // start og hver efterfølgende ændring. Findes ingen sats på/før reguleringsdatoen, viser tabellen
    // den tidligste kendte sats og ledsages af en note. Hver relevant dato er præcis en periode-
    // startdato (resolveRelevantRealDatesForTafScope filtrerer kun periodStarts), så den fundne
    // entry's reguleringsPct er den samme værdi getKlLoenaftalerReguleringPctForDato tidligere slog op.
    const rows: string[][] = relevantRealDates.flatMap((iso) => {
      const period = findLatestByDateInSortedList(periodStarts, iso, 'kl:presentation');
      if (!period) return [];
      return [[formatDateShort(iso), formatKlPct(period.reguleringsPct)]];
    });
    return {
      columns: ['Fra-dato', 'Regulering'],
      rows: mergeConsecutiveValueRows(rows),
      // Kildens uscopede tidligste sats (periodStarts er sorteret stigende), IKKE relevantRealDates[0].
      tidligsteSatsGaelderFra: resolveTidligsteSatsGaelderFra(periodStarts[0].startIso, anvendtReguleringsdato),
    };
  }

  return null;
};

/** Formatterer udelukkende motorens anvendte regulering; der vælges aldrig satser her. */
export const buildReguleringIndexRows = (params: Readonly<{
  segments: readonly LoenudviklingSegment[];
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  anvendtReguleringsdato: ISODateString | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
  forloeb?: ReguleringForloeb;
}>): readonly ReguleringIndexRow[] => {
  const { segments } = params;
  const components = segments.flatMap((segment) => {
    const bevis = segment.regulering;
    return [bevis?.referenceComponents, bevis?.periodComponents].filter(
      (value): value is FormulaComponents => value !== undefined
    );
  });
  const visibility: FormulaVisibility = {
    showFritvalg: components.some((value) => !isEffectivelyZero(value.fritvalgPct)),
    showShSo: components.some((value) => !isEffectivelyZero(value.shSoPct)),
    showPension: components.some((value) => !isEffectivelyZero(value.pensionPct)),
    showStoreBededag: components.some((value) => !isEffectivelyZero(value.storeBededagPct)),
  };
  const rows: IndexRowWithIso[] = segments.map((segment) => {
    const bevis = segment.regulering;
    if (!bevis) throw new Error('Motorens reguleringsgrundlag mangler ved visning');
    let indeksberegning = '';
    let indeks = '';
    let loenudvikling: string;
    let reguleretLoen: string | undefined;
    if (bevis.kind === 'klLoenaftaler') {
      if (segment.reguleretLoenOre === undefined) throw new Error('Motorens regulerede KL-løn mangler ved visning');
      reguleretLoen = formatAsAmount(segment.reguleretLoenOre / 100, 2);
      loenudvikling = bevis.periodePct === undefined ? '' : `${formatAsAmount(bevis.periodePct, 2)} %`;
    } else {
      // Indekset og procenten viser den faktor, der faktisk anvendes efter formens afrunding.
      // Før blev de genberegnet fra en separat inputprojektion, mens beløbet brugte en anden.
      indeks = formatIndexValue(100 + bevis.appliedDeltaPct);
      loenudvikling = isEffectivelyZero(bevis.appliedDeltaPct) ? ''
        : `${bevis.appliedDeltaPct > 0 ? '+ ' : '- '}${formatAsAmount(Math.abs(bevis.appliedDeltaPct), 2)} %`;
      if (bevis.referenceComponents && bevis.periodComponents) {
        indeksberegning = buildIndexFormulaDisplay(
          buildFormulaText(bevis.periodComponents, visibility),
          buildFormulaText(bevis.referenceComponents, visibility),
          bevis.periodValue, bevis.referenceValue, false
        );
      } else if (bevis.kind === 'ingen') {
        indeksberegning = '100,00';
      } else {
        const formatValue = bevis.sourceKind === 'asl' ? formatCurrency
          : (value: number) => formatAsAmount(value, bevis.displayDecimals ?? 2);
        indeksberegning = buildIndexFormulaDisplay(
          formatValue(bevis.periodValue), formatValue(bevis.referenceValue),
          bevis.periodValue, bevis.referenceValue, true
        );
      }
    }
    return {
      fraIso: segment.fra, tilIso: segment.til,
      fraDato: formatDateShort(segment.fra), tilDato: formatDateShort(segment.til),
      indeksberegning, indeks, loenudvikling,
      ...(reguleretLoen !== undefined ? { reguleretLoen } : {}),
      signature: `${indeksberegning}|${indeks}|${loenudvikling}|${reguleretLoen ?? ''}`,
    };
  });
  // Store Bededag-grænsen skal fortsat kunne ses, selv når de afrundede faktorer er ens.
  return mergeConsecutiveRowsWithSameCalculation(rows, {
    preserveStartIsos: new Set([STORE_BEDEDAG_START]),
  });
};
