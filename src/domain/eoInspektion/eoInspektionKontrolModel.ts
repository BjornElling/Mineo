import { resolveIndkomstFerieperioder } from '../erstatningsopgoerelse/helpers/indkomstFerieperioder';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow, SvieSmertePeriodeRow } from '../../schemas/formSchemas';
import type { SvieSmerteConstrainedPeriod } from '../erstatningsopgoerelse/engines/svieSmerteEngine';
import type { ISODateString } from '../../types/branded';
import { dateToISO, isoToDanish } from '../../types/branded';
import type { IsoRange } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { formatCurrency } from '../../utils/formatUtils';
import { isStandardLoenRowEffectivelyEmpty } from '../aarsloen/standardLoenRowCalculations';
import { buildOffentligeYdelserColumns, parseOffentligDato } from './eoInspektionOffentligeYdelserColumns';
import { buildLoenindkomstColumns, buildTafDayStatusValues } from './eoInspektionLoenColumns';
import { kontrolTabelColumnId, type KontrolTabelWageColumnKey } from './eoInspektionLoenTypes';
import { isoDateToDate } from '../dates/isoDate';
import {
  getOffentligeYdelserErrorRowIdSet,
  getStandardLoenErrorRowIdSet,
} from '../erstatningsopgoerelse/validation/indkomstRowValidation';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { buildTafRanges, parseAarsloenRowInterval } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { SYGEDAGPENGE_SH_CUTOFF } from '../erstatningsopgoerelse/engines/periodiseringsMotor';
import { buildShDageSetFromIsoRange } from '../erstatningsopgoerelse/engines/tafDaySets';
import { iterateDatesInclusive, maxISO, minISO, validateIsoRange } from '../../utils/isoDateHelpers';
import type { RowDay } from '../eoRowEvaluation/eoRowTypes';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';
import { erTabtArbejdsfortjenesteSektionAktiv } from '../erstatningsopgoerelse/helpers/eoInputRelevance';
import { resolveMidlertidigEetDato, resolveTafCutoffDates } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { resolveSvieSmerteCutoffDate } from '../erstatningsopgoerelse/validation/svieSmerteConstraints';
import { TAF_MIDLERTIDIG_EET_SKAERINGSDATO } from '../erstatningsopgoerelse/helpers/eoConstants';

export type KontrolTabelDateSource = Readonly<{
  label: string;
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
}>;

/** Sikker projektion af beregningsperioden fra EO's TAF-input og dets konkrete feltissues. */
export type EOInspektionBeregningsperiodeProjection = Readonly<{
  range: IsoRange | undefined;
}>;

export type KontrolTabelColumnId =
  | (typeof KONTROL_TABEL_COLUMN_IDS)[keyof typeof KONTROL_TABEL_COLUMN_IDS]
  | `loen:${number}:taf_regulering`
  | `loen:${number}:wage:${KontrolTabelWageColumnKey}`
  | `offentlig:${string}`;

export type KontrolTabelColumn = Readonly<{
  id: KontrolTabelColumnId;
  header: string;
  /** Navnet uden overskriftens layout-linjeskift og forkortelser; CSV-filens kolonnenavn. */
  name: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  getCell: (rowIndex: number) => string;
}>;

export const KONTROL_TABEL_COLUMN_IDS = {
  weekday: 'base:weekday',
  date: 'base:date',
  hverdag: 'base:hverdag',
  shDay: 'base:sh_day',
  ferieDay: 'base:ferie_day',
  arbejdsdag: 'base:arbejdsdag',
  ssDay: 'base:ss_day',
  tafDay: 'base:taf_day',
} as const;

export { kontrolTabelColumnId };
export type { KontrolTabelWageColumnKey };

export type KontrolTabelRow = Readonly<{
  key: ISODateString;
  cells: Readonly<Record<KontrolTabelColumnId, string>>;
}>;

export type KontrolTabelColumnData = Readonly<{
  id: KontrolTabelColumnId;
  header: string;
  /** Se {@link KontrolTabelColumn.name}; udeladt er det overskriften, som da ikke har linjeskift. */
  name?: string;
  align: 'left' | 'center' | 'right';
  width: number;
  borderLeft?: boolean;
  values: readonly string[];
  rawValues?: readonly number[];
}>;

type EOInspektionTableData = Readonly<{
  dates: readonly ISODateString[];
  weekdayIndexByRow: readonly RowDay['weekday'][];
  isSognehelligdagByIndex: readonly boolean[];
  isWorkdayByIndex: readonly boolean[];
  ssStatusByIndex: readonly string[];
  svieSmerteByIndex: readonly RowDay['svieSmerte'][];
  tafDayStatusByIndex: readonly string[];
  tafColumnIds: readonly KontrolTabelColumnId[];
  tafFlagsByIndex: readonly ReadonlySet<string>[];
}>;

export type EOInspektionModel = Readonly<{
  sources: readonly KontrolTabelDateSource[];
  tafAfskaering: readonly KontrolTabelTafAfskaeringRaekke[];
  combinedMinFra: ISODateString | undefined;
  combinedMaxTil: ISODateString | undefined;
  tableFra: ISODateString | undefined;
  tableTil: ISODateString | undefined;
  summaryTableFra: ISODateString | undefined;
  summaryTableTil: ISODateString | undefined;
  rowCount: number;
  getRowKey: (rowIndex: number) => string;
  getCell: (rowIndex: number, colId: KontrolTabelColumnId) => string;
  columns: readonly KontrolTabelColumn[];
  rows: readonly KontrolTabelRow[];
  tableWidthPx: number;
  tableData: EOInspektionTableData;
  columnRawValues: ReadonlyMap<KontrolTabelColumnId, readonly number[]>;
}>;

const DEFAULT_TABLE_WIDTH_PX = 1200;
const DEFAULT_COLUMN_WIDTH_PX = 120;

/**
 * «Svie/smerte-dag» som sammentællingens «Svie/smerte»-rækker (BB-387); før «S/S dag». Brudt efter bindestregen,
 * fordi hele ordet ikke kan stå på én linje i kolonnens 120 px.
 */
const SVIE_SMERTE_DAG_HEADER = 'Svie/smerte-\ndag';

const weekdayNamesDa: ReadonlyArray<string> = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
];

const computeSummaryTableRange = (
  combinedMinFra: ISODateString | undefined,
  combinedMaxTil: ISODateString | undefined
): { fra: ISODateString | undefined; til: ISODateString | undefined } => {
  let tableFra: ISODateString | undefined = undefined;
  let tableTil: ISODateString | undefined = undefined;

  if (combinedMinFra) {
    const fraDate = isoDateToDate(combinedMinFra);
    const year = fraDate.getUTCFullYear();
    const month = fraDate.getUTCMonth() + 1;
    tableFra = `${year}-${String(month).padStart(2, '0')}-01` as ISODateString;
  }

  if (combinedMaxTil) {
    const tilDate = isoDateToDate(combinedMaxTil);
    const year = tilDate.getUTCFullYear();
    const month = tilDate.getUTCMonth() + 1;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    tableTil = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}` as ISODateString;
  }

  return { fra: tableFra, til: tableTil };
};

/**
 * Kontroltabellen har ansættelsesforholdskolonner (TAF-regulering og lønkolonnerne) kun med TAF-krav. Uden TAF
 * stod en tom «TAF-regulering» under et navnløst «Ansættelsesforhold 1» (BB-388). Sammentællingens
 * ansættelsesforholdsrækker læser de samme kolonner og følger derfor samme gate.
 */
export const harKontrolTabelAnsaettelsesforholdKolonner = (
  values: Pick<ErstatningsopgoerelseValues, 'kravPaaTabtArbejdsfortjeneste'>
): boolean => erTabtArbejdsfortjenesteSektionAktiv(values);

export type KontrolTabelTafAfskaeringRaekke = Readonly<{
  label: string;
  dato: ISODateString;
}>;

/**
 * Oversigten over de datoer, der kan afslutte TAF, og om de gør det i sagen.
 *
 * Reglen er den, motoren og valideringen bruger (`resolveTafCutoffDates`): TAF ophører fra og med differencekravets
 * dato og det endelige EET's dato. Det midlertidige EET's dato afslutter kun TAF for skader før 16-06-2011; for
 * senere skader fortsætter TAF. Under en verserende klage over EET afslutter ingen EET-dato TAF. Oversigten viser
 * også de EET-datoer, der IKKE afslutter TAF, og hvorfor, så tabellen tydeligt viser, hvilken regel den håndhæver.
 */
export const buildTafAfskaeringOversigt = (
  values: ErstatningsopgoerelseValues,
  skadedatoISO: ISODateString | undefined
): readonly KontrolTabelTafAfskaeringRaekke[] => {
  if (!erTabtArbejdsfortjenesteSektionAktiv(values)) return [];
  const cutoffs = resolveTafCutoffDates({ ...values, skadedatoISO });
  const skaeringsdato = isoToDanish(TAF_MIDLERTIDIG_EET_SKAERINGSDATO) ?? TAF_MIDLERTIDIG_EET_SKAERINGSDATO;
  const klage = values.verserendeKlageEet === 'Ja';
  const rows: KontrolTabelTafAfskaeringRaekke[] = [];

  if (cutoffs.differencekravDato) {
    rows.push({ label: 'TAF ophører: differencekrav opgjort pr.', dato: cutoffs.differencekravDato });
  }

  const endeligDato = values.endeligtEETAfgorelse === 'Ja'
    ? values.endeligEETVirkningsdato ?? values.endeligEETAfgoerelseDato
    : undefined;
  if (cutoffs.endeligEETDato) {
    rows.push({ label: 'TAF ophører: endeligt EET', dato: cutoffs.endeligEETDato });
  } else if (endeligDato && klage) {
    rows.push({ label: 'Endeligt EET – TAF fortsætter (verserende klage)', dato: endeligDato });
  }

  const midlertidigDato = resolveMidlertidigEetDato(values);
  if (cutoffs.midlertidigEETDato) {
    rows.push({
      label: `TAF ophører: midlertidigt EET (skade før ${skaeringsdato})`,
      dato: cutoffs.midlertidigEETDato,
    });
  } else if (midlertidigDato) {
    const grund = klage
      ? 'verserende klage'
      : skadedatoISO === undefined
        ? 'skadedato mangler'
        : `skade fra ${skaeringsdato}`;
    rows.push({ label: `Midlertidigt EET – TAF fortsætter (${grund})`, dato: midlertidigDato });
  }

  return rows.sort((left, right) => left.dato.localeCompare(right.dato));
};

const buildIsoIndex = (dates: readonly ISODateString[]): ReadonlyMap<ISODateString, number> => {
  const map = new Map<ISODateString, number>();
  dates.forEach((d, idx) => map.set(d, idx));
  return map;
};

const buildDateList = (fra: ISODateString, til: ISODateString): readonly ISODateString[] => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  const out: ISODateString[] = [];
  iterateDatesInclusive(start, end, (d) => {
    const iso = dateToISO(d);
    if (iso) out.push(iso);
  });
  return out;
};

const addWeekdayNonShDatesFromIsoRange = (
  set: Set<ISODateString>,
  fra: ISODateString,
  til: ISODateString,
  shDays: ReadonlySet<ISODateString>
): void => {
  const start = isoDateToDate(fra);
  const end = isoDateToDate(til);
  iterateDatesInclusive(start, end, (d) => {
    const dow = d.getUTCDay();
    const erHverdag = dow >= 1 && dow <= 5;
    if (!erHverdag) return;
    const iso = dateToISO(d);
    if (!iso) return;
    if (shDays.has(iso)) return;
    set.add(iso);
  });
};

const buildExplicitFerieSet = (values: ErstatningsopgoerelseValues, shDays: ReadonlySet<ISODateString>): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();

  // Samme ferie som motorens fordeling: hver tabel i sin egen periode.
  const ferieRows = resolveIndkomstFerieperioder(values);
  for (const row of ferieRows) {
    const range = validateIsoRange(row.fra, row.til);
    if (!range) continue;
    addWeekdayNonShDatesFromIsoRange(set, range.fra, range.til, shDays);
  }

  return set;
};

const buildTafDatesFromRanges = (tafRanges: readonly IsoRange[]): ReadonlySet<ISODateString> => {
  const set = new Set<ISODateString>();
  for (const range of tafRanges) {
    const start = isoDateToDate(range.fra);
    const end = isoDateToDate(range.til);
    iterateDatesInclusive(start, end, (d) => {
      const iso = dateToISO(d);
      if (iso) set.add(iso);
    });
  }
  return set;
};

const collectMinMaxOffentligeYdelser = (
  rows: readonly OffentligeYdelserRow[],
  errorRowIds: ReadonlySet<string>
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  for (const row of rows) {
    if (errorRowIds.has(row.id)) continue;
    const ydelsestype = row.ydelsestype?.trim() ?? '';
    if (ydelsestype === '') continue;

    const fraISO = parseOffentligDato(row.fraDato);
    const tilISO = parseOffentligDato(row.tilDato);
    const range = validateIsoRange(fraISO, tilISO);
    if (!range) continue;
    min = minISO(min, range.fra);
    max = maxISO(max, range.til);
  }

  return { min, max };
};

const collectMinMaxLoenindkomst = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'],
  errorRowIdsByIndex: ReadonlyArray<ReadonlySet<string>>
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  for (let index = 0; index < ansaettelsesforhold.length; index += 1) {
    const af = ansaettelsesforhold[index];
    const errorRowIds = errorRowIdsByIndex[index] ?? new Set<string>();
    const rows = af.indtaegtsoplysningerTableData ?? [];

    for (const row of rows) {
      if (errorRowIds.has(row.id)) continue;
      if (isStandardLoenRowEffectivelyEmpty(row, af.loenperiode, af.tillaegAngivesSom)) {
        continue;
      }
      const interval = parseAarsloenRowInterval(row, af.loenperiode);
      if (!interval) continue;
      const startISO = dateToISO(interval.start);
      const endISO = dateToISO(interval.end);
      if (!startISO || !endISO) continue;
      min = minISO(min, startISO);
      max = maxISO(max, endISO);
    }
  }

  return { min, max };
};

const collectMinMaxSvieSmerte = (
  values: ErstatningsopgoerelseValues,
  erstatningsFra: ISODateString | undefined,
  erstatningsTil: ISODateString | undefined,
  menStopDato: ISODateString | undefined,
  constrainedPeriods?: readonly SvieSmerteConstrainedPeriod[]
): { min: ISODateString | undefined; max: ISODateString | undefined } => {
  let min: ISODateString | undefined;
  let max: ISODateString | undefined;

  if (constrainedPeriods) {
    for (const periode of constrainedPeriods) {
      min = minISO(min, periode.fra);
      max = maxISO(max, periode.til);
    }
    return { min, max };
  }

  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  if (!erstatningsRange) {
    return { min: undefined, max: undefined };
  }

  const maxSsDato = menStopDato ? getDayBeforeIso(menStopDato) : erstatningsRange.til;
  const perioder: readonly SvieSmertePeriodeRow[] = values.svieSmertePerioder ?? [];

  for (const periode of perioder) {
    const tilstand = periode.tilstand;
    if (tilstand !== 'sygemeldt' && tilstand !== 'delvist-sygemeldt') continue;
    const periodeRange = validateIsoRange(periode.fra, periode.til);
    if (!periodeRange) continue;

    const clampedFra = maxISO(periodeRange.fra, erstatningsRange.fra);
    const clampedTil = minISO(periodeRange.til, maxSsDato);
    const clampedRange = validateIsoRange(clampedFra, clampedTil);
    if (!clampedRange) continue;

    min = minISO(min, clampedRange.fra);
    max = maxISO(max, clampedRange.til);
  }

  return { min, max };
};

const buildSsCoverage = (
  dates: readonly ISODateString[],
  isoIndex: ReadonlyMap<ISODateString, number>,
  values: ErstatningsopgoerelseValues,
  erstatningsFra: ISODateString | undefined,
  erstatningsTil: ISODateString | undefined,
  menStopDato: ISODateString | undefined,
  /** Clampede svie/smerte-perioder fra engine. Når leveret bruges disse direkte
   *  i stedet for at genimplementere clamping fra values – sikrer at tabellen
   *  afspejler præcis de perioder der indgik i beregningen. */
  constrainedPeriods?: readonly SvieSmerteConstrainedPeriod[]
): { statusByIndex: readonly string[]; stopAfterMenByIndex: readonly boolean[] } => {
  const dayCount = dates.length;
  const statusByIndex: string[] = Array.from({ length: dayCount }, () => '-');
  const stopAfterMenByIndex: boolean[] = Array.from({ length: dayCount }, () => false);

  const erstatningsRange = validateIsoRange(erstatningsFra, erstatningsTil);
  if (!erstatningsRange) {
    return { statusByIndex, stopAfterMenByIndex };
  }

  const maxSsDato = menStopDato ? getDayBeforeIso(menStopDato) : erstatningsRange.til;

  const sygemeldt = new Uint8Array(dayCount);
  const delvist = new Uint8Array(dayCount);

  if (constrainedPeriods) {
    // Autoritativ sti: brug engine-outputtets clampede perioder direkte.
    // constrainedPeriods er allerede clamped mod alle bounds (vedroerer, ménafgørelse osv.).
    for (const periode of constrainedPeriods) {
      const start = isoDateToDate(periode.fra);
      const end = isoDateToDate(periode.til);
      iterateDatesInclusive(start, end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (periode.isDelvist) delvist[idx] = 1;
        else sygemeldt[idx] = 1;
      });
    }
  } else {
    // Fallback: validerings-fejl-sti og standalone/test-brug.
    // Genimplementerer clamping fra values – samme logik som engine, men selvstændig.
    const hasSsMax = maxSsDato !== undefined;
    const perioder: readonly SvieSmertePeriodeRow[] = values.svieSmertePerioder ?? [];
    for (const periode of perioder) {
      const tilstand = periode.tilstand;
      if (tilstand !== 'sygemeldt' && tilstand !== 'delvist-sygemeldt') continue;
      const periodeRange = validateIsoRange(periode.fra, periode.til);
      if (!periodeRange) continue;

      const clampedFra = maxISO(periodeRange.fra, erstatningsRange.fra);
      const clampedTil = hasSsMax ? minISO(periodeRange.til, maxSsDato) : periodeRange.til;
      const clampedRange = validateIsoRange(clampedFra, clampedTil);
      if (!clampedRange) continue;

      const start = isoDateToDate(clampedRange.fra);
      const end = isoDateToDate(clampedRange.til);
      iterateDatesInclusive(start, end, (d) => {
        const iso = dateToISO(d);
        if (!iso) return;
        const idx = isoIndex.get(iso);
        if (idx === undefined) return;
        if (tilstand === 'sygemeldt') sygemeldt[idx] = 1;
        else delvist[idx] = 1;
      });
    }
  }

  for (let i = 0; i < dayCount; i += 1) {
    const iso = dates[i];
    const withinErstatning = iso >= erstatningsRange.fra && iso <= erstatningsRange.til;
    if (!withinErstatning) {
      statusByIndex[i] = '';
      stopAfterMenByIndex[i] = false;
      continue;
    }

    if (menStopDato && iso === menStopDato) {
      statusByIndex[i] = 'Varige Mén';
      stopAfterMenByIndex[i] = false;
      continue;
    }

    if (menStopDato && iso > menStopDato) {
      statusByIndex[i] = '-';
      stopAfterMenByIndex[i] = true;
      continue;
    }

    if (sygemeldt[i] === 1) statusByIndex[i] = 'Ja';
    else if (delvist[i] === 1) statusByIndex[i] = 'Delvis';
    else statusByIndex[i] = '-';

    stopAfterMenByIndex[i] = false;
  }

  return { statusByIndex, stopAfterMenByIndex };
};

export const buildEOInspektionModel = (
  values: ErstatningsopgoerelseValues,
  options: Readonly<{
    tafRanges?: readonly IsoRange[];
    skadedatoISO?: ISODateString;
    beregningsperiodeProjection?: EOInspektionBeregningsperiodeProjection;
    /** Clampede svie/smerte-perioder fra engine. Når leveret afspejler kontroltabellen
     *  præcist de perioder der indgik i beregningen – ikke de rå committede datoer. */
    svieSmerteConstrainedPeriods?: readonly SvieSmerteConstrainedPeriod[];
  }> = {}
): EOInspektionModel => {
  const erstatningsFra = values.vedroererPeriodeFra;
  const erstatningsTil = values.vedroererPeriodeTil;
  const isBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
  // Snapshot-pipelinen leverer en issue-gatet projektion. Direkte modelkald uden snapshot beholder den
  // eksisterende rå-inputsti til selvstændige kontrolmodeller og deres tests.
  const projectedBeregningsperiodeRange = options.beregningsperiodeProjection?.range;
  const beregningsFra = options.beregningsperiodeProjection === undefined
    ? values.tafBeregningsperiodeFra
    : projectedBeregningsperiodeRange?.fra;
  const beregningsTil = options.beregningsperiodeProjection === undefined
    ? values.tafBeregningsperiodeTil
    : projectedBeregningsperiodeRange?.til;
  // Ménafskæringen hentes fra samme opslag som svie/smerte-motoren (`resolveSvieSmerteCutoffDate`), så
  // kontroltabellen håndhæver motorens regel og ikke en egen kopi, der kan drive fra den (som TAF's EET-afskæring
  // ovenfor; eo-snapshot-contract.md §6.2).
  const menStopDato = resolveSvieSmerteCutoffDate(values);

  const loenErrorRowIdsByIndex = (values.loenindkomstAnsaettelsesforhold ?? []).map((af) =>
    getStandardLoenErrorRowIdSet(af.indtaegtsoplysningerTableData ?? [], af.loenperiode, af.tillaegAngivesSom)
  );
  const offentligeErrorRowIds = getOffentligeYdelserErrorRowIdSet(values.offentligeYdelserRows ?? []);

  const loenBounds = collectMinMaxLoenindkomst(values.loenindkomstAnsaettelsesforhold ?? [], loenErrorRowIdsByIndex);
  const ydelserBounds = collectMinMaxOffentligeYdelser(values.offentligeYdelserRows ?? [], offentligeErrorRowIds);
  const svieSmerteBounds = collectMinMaxSvieSmerte(
    values,
    erstatningsFra,
    erstatningsTil,
    menStopDato,
    options.svieSmerteConstrainedPeriods
  );

  // Brug clampede tafRanges hvis de er leveret (fra engines – altid præfereret).
  // Fallback bruger den kanoniske buildTafRanges-sti til standalone/test-brug.
  // Snapshot-pipelinen skal fortsat levere tafRanges for fuld parity med den konkrete beregning.
  const resolvedTafRanges: readonly IsoRange[] = options.tafRanges
    ?? buildTafRanges(values, { skadedatoISO: options.skadedatoISO });
  // TAF-perioderne skal indgå som datokilde, så tabellen altid dækker præcis de dage,
  // beregnings-engine'n beregner TAF over. Uden dette kunne en TAF-periode, der ligger uden
  // for løn-/ydelses-/erstatningsperiode-intervallerne, falde helt uden for tabellen – og så
  // ville kontroltabellen vise 0 TAF-dage mens snapshot beregner et reelt tal (falsk
  // control:sammentaelling_mismatch). Når en erstatningsperiode findes, er tafRanges allerede clampet
  // ind i den, så denne kilde udvider intet i det tilfælde.
  const isTafEnabledForSource = values.kravPaaTabtArbejdsfortjeneste === 'Ja';
  const tafSourceFra = isTafEnabledForSource
    ? resolvedTafRanges.reduce<ISODateString | undefined>((acc, r) => minISO(acc, r.fra), undefined)
    : undefined;
  const tafSourceTil = isTafEnabledForSource
    ? resolvedTafRanges.reduce<ISODateString | undefined>((acc, r) => maxISO(acc, r.til), undefined)
    : undefined;

  const tafAfskaering = buildTafAfskaeringOversigt(values, options.skadedatoISO);

  const sources: KontrolTabelDateSource[] = [
    { label: 'Erstatningsperiode', fra: erstatningsFra, til: erstatningsTil },
    {
      label: 'Beregningsperiode',
      fra: isBeregningsperiode ? beregningsFra : undefined,
      til: isBeregningsperiode ? beregningsTil : undefined,
    },
    { label: 'Lønindkomst', fra: loenBounds.min, til: loenBounds.max },
    { label: 'Offentlige ydelser', fra: ydelserBounds.min, til: ydelserBounds.max },
    { label: 'Svie/smerte', fra: svieSmerteBounds.min, til: svieSmerteBounds.max },
    { label: 'TAF-perioder', fra: tafSourceFra, til: tafSourceTil },
  ];

  const combinedMinFra = sources.reduce<ISODateString | undefined>((acc, s) => minISO(acc, s.fra), undefined);
  const combinedMaxTil = sources.reduce<ISODateString | undefined>((acc, s) => maxISO(acc, s.til), undefined);

  const { fra: summaryTableFra, til: summaryTableTil } = computeSummaryTableRange(combinedMinFra, combinedMaxTil);
  const tableFra = summaryTableFra;
  const tableTil = summaryTableTil;

  if (!tableFra || !tableTil || tableFra > tableTil) {
    return {
      sources,
      tafAfskaering,
      combinedMinFra,
      combinedMaxTil,
      tableFra,
      tableTil,
      summaryTableFra,
      summaryTableTil,
      rowCount: 0,
      getRowKey: (rowIndex) => String(rowIndex),
      getCell: () => '',
      columns: [],
      rows: [],
      tableWidthPx: DEFAULT_TABLE_WIDTH_PX,
      tableData: {
        dates: [],
        weekdayIndexByRow: [],
        isSognehelligdagByIndex: [],
        isWorkdayByIndex: [],
        ssStatusByIndex: [],
        svieSmerteByIndex: [],
        tafDayStatusByIndex: [],
        tafColumnIds: [],
        tafFlagsByIndex: [],
      },
      columnRawValues: new Map(),
    };
  }

  const dates = buildDateList(tableFra, tableTil);
  const isoIndex = buildIsoIndex(dates);
  const beregningsenhed = computeTafBeregningsenhed(values);
  const erMaaneder = beregningsenhed === TAF_BEREGNES_SOM.MAANEDER;
  const shDays = buildShDageSetFromIsoRange(tableFra, tableTil);
  const explicitFerie = buildExplicitFerieSet(values, shDays);
  const tafDates = buildTafDatesFromRanges(resolvedTafRanges);

  const beregningsRange = validateIsoRange(beregningsFra, beregningsTil);
  const weekdayByIndex: string[] = new Array(dates.length);
  const danishDateByIndex: string[] = new Array(dates.length);
  const isWeekdayByIndex: boolean[] = new Array(dates.length);
  const isShByIndex: boolean[] = new Array(dates.length);
  const isFerieByIndex: boolean[] = new Array(dates.length);
  const isWithinBeregningsByIndex: boolean[] = new Array(dates.length);
  const isWorkdayByIndex: boolean[] = new Array(dates.length);

  for (let i = 0; i < dates.length; i += 1) {
    const iso = dates[i];
    const d = isoDateToDate(iso);
    const dow = d.getUTCDay();
    weekdayByIndex[i] = weekdayNamesDa[dow] ?? '';
    danishDateByIndex[i] = isoToDanish(iso) ?? '';
    const weekday = dow >= 1 && dow <= 5;
    isWeekdayByIndex[i] = weekday;
    const sh = shDays.has(iso);
    isShByIndex[i] = sh;
    // "Feriedag" i kontroltabellen er kun daterede ferieperioder.
    // Arbejdsdag i tabellen følger beregningsenheden:
    // - Måneder: alle hverdage markeres også som arbejdsdag (inkl. SH/ferie).
    // - Arbejdsdage: hverdage ekskl. SH/feriedage markeres som arbejdsdag.
    const ferie = explicitFerie.has(iso);
    isFerieByIndex[i] = ferie;
    isWorkdayByIndex[i] = erMaaneder ? weekday : weekday && !sh && !ferie;
    const withinBeregnings = beregningsRange ? iso >= beregningsRange.fra && iso <= beregningsRange.til : false;
    isWithinBeregningsByIndex[i] = withinBeregnings;
  }

  const { statusByIndex: ssStatusByIndex } = buildSsCoverage(
    dates,
    isoIndex,
    values,
    erstatningsFra,
    erstatningsTil,
    menStopDato,
    options.svieSmerteConstrainedPeriods
  );

  const baseColumns: KontrolTabelColumnData[] = [
    {
      id: KONTROL_TABEL_COLUMN_IDS.weekday,
      header: 'Ugedag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: weekdayByIndex,
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.date,
      header: 'Dato',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: danishDateByIndex,
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.hverdag,
      header: 'Hverdag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isWeekdayByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.shDay,
      // Samme navn som sammentællingens «SH-dage» (BB-387); før «S/H dag».
      header: 'SH-dag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isShByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.ferieDay,
      header: 'Feriedag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: dates.map((iso) => (explicitFerie.has(iso) ? 'x' : '')),
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.arbejdsdag,
      header: 'Arbejdsdag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      values: isWorkdayByIndex.map((value) => (value ? 'x' : '')),
    },
    {
      id: KONTROL_TABEL_COLUMN_IDS.ssDay,
      header: SVIE_SMERTE_DAG_HEADER,
      name: 'Svie/smerte-dag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      borderLeft: true,
      values: ssStatusByIndex.map((value) => value ?? '-'),
    },
  ];

  // TAF-dagene beregnes ét sted og læses både af kolonnen og af sammentællingen; før blev de beregnet to gange.
  const tafDayStatusByIndex = buildTafDayStatusValues({
    dates,
    erstatningsFra,
    erstatningsTil,
    cutoffs: resolveTafCutoffDates({ ...values, skadedatoISO: options.skadedatoISO }),
    tafDates,
    isWorkdayByIndex,
    isWithinBeregningsByIndex,
  });
  // Kolonnen er grundlaget for sammentællingens TAF-dage og vises derfor, når der er TAF-krav – også uden et
  // ansættelsesforhold (angivet løn), hvor den før manglede, selvom dagene blev talt.
  const tafDayColumns: KontrolTabelColumnData[] = isTafEnabledForSource
    ? [{
      id: KONTROL_TABEL_COLUMN_IDS.tafDay,
      // Samme skrivemåde som «SH-dag» og «Svie/smerte-dag» (BB-387).
      header: 'TAF-dag',
      align: 'center',
      width: DEFAULT_COLUMN_WIDTH_PX,
      borderLeft: true,
      values: tafDayStatusByIndex,
    }]
    : [];

  const { columns: loenColumns } = buildLoenindkomstColumns({
    dates,
    isoIndex,
    values,
    isWorkdayByIndex,
    tableFra,
    tableTil,
    columnWidthPx: DEFAULT_COLUMN_WIDTH_PX,
    errorRowIdsByIndex: loenErrorRowIdsByIndex,
    medAnsaettelsesforholdKolonner: harKontrolTabelAnsaettelsesforholdKolonner(values),
  });

  const { columns: offentlige } = buildOffentligeYdelserColumns({
    dates,
    isoIndex,
    values,
    shDays,
    sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
    errorRowIds: offentligeErrorRowIds,
  });
  const offentligeColumns: KontrolTabelColumnData[] = offentlige.map((c, idx) => ({
    id: kontrolTabelColumnId.offentlig(c.typeKey),
    header: c.header,
    name: c.name,
    align: 'right',
    width: DEFAULT_COLUMN_WIDTH_PX,
    borderLeft: idx === 0,
    rawValues: Array.from(c.amountsByIndex),
    values: Array.from({ length: dates.length }, (_, rowIndex) => {
      const value = c.amountsByIndex[rowIndex];
      return value === 0 ? '' : formatCurrency(value);
    }),
  }));

  const columnData: KontrolTabelColumnData[] = [...baseColumns, ...tafDayColumns, ...loenColumns, ...offentligeColumns];
  const columnRawValues = new Map<KontrolTabelColumnId, readonly number[]>();
  for (const col of columnData) {
    if (col.rawValues) {
      columnRawValues.set(col.id, col.rawValues);
    }
  }
  const columns: KontrolTabelColumn[] = columnData.map((col) => ({
    id: col.id,
    header: col.header,
    name: col.name ?? col.header,
    align: col.align,
    width: col.width,
    borderLeft: col.borderLeft,
    getCell: (rowIndex) => col.values[rowIndex] ?? '',
  }));
  const rows: KontrolTabelRow[] = dates.map((iso, rowIndex) => {
    const cells: Record<KontrolTabelColumnId, string> = {} as Record<KontrolTabelColumnId, string>;
    for (const col of columnData) {
      cells[col.id] = col.values[rowIndex] ?? '';
    }
    return { key: iso, cells };
  });
  const tableWidthPx = Math.max(DEFAULT_TABLE_WIDTH_PX, columnData.length * DEFAULT_COLUMN_WIDTH_PX + 40);

  // Summary-tabellen bruger samme interval som kontroltabellen (månedsgrænser).
  const tafColumnIds = columnData
    .filter((col) => col.id === KONTROL_TABEL_COLUMN_IDS.tafDay)
    .map((col) => col.id);
  const tafFlagsByIndex = dates.map((_, rowIndex) => {
    const activeColumns = tafDayStatusByIndex[rowIndex] === 'Ja' ? tafColumnIds : [];
    return new Set<string>(activeColumns);
  });
  const weekdayIndexByRow = dates.map((iso) => isoDateToDate(iso).getUTCDay() as RowDay['weekday']);
  const isSognehelligdagByIndex = dates.map((iso) => shDays.has(iso));
  const svieSmerteByIndex = ssStatusByIndex.map((value): RowDay['svieSmerte'] => {
    if (value === 'Ja') return 'Fuld';
    if (value === 'Delvis') return 'Delvis';
    return 'Ingen';
  });

  return {
    sources,
    tafAfskaering,
    combinedMinFra,
    combinedMaxTil,
    tableFra,
    tableTil,
    summaryTableFra,
    summaryTableTil,
    rowCount: dates.length,
    getRowKey: (rowIndex) => dates[rowIndex] ?? String(rowIndex),
    getCell: (rowIndex, colId) => rows[rowIndex]?.cells[colId] ?? '',
    columns,
    rows,
    tableWidthPx,
    tableData: {
      dates,
      weekdayIndexByRow,
      isSognehelligdagByIndex,
      isWorkdayByIndex,
      ssStatusByIndex,
      svieSmerteByIndex,
      tafDayStatusByIndex,
      tafColumnIds,
      tafFlagsByIndex,
    },
    columnRawValues,
  };
};
