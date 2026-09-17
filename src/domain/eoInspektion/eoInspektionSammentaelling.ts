import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { getDayBeforeIso } from '../../utils/isoDateHelpers';

import { formatAsAmountTrimmed, formatCurrency } from '../../utils/formatUtils';
import { parseDanishNumberString as parseCanonicalDanishNumberString } from '../../utils/numberParsing';
import { kontrolTabelColumnId } from './eoInspektionLoenTypes';
import type { EOInspektionModel } from './eoInspektionKontrolModel';
import { calculateTafArbejdsdageBreakdown } from '../erstatningsopgoerelse/engines/tafCalculations';
import { computeTafOverlapWithBeregningsperiode } from '../erstatningsopgoerelse/engines/beregningsperiodeTafOverlap';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { buildBeregningsperiodeRange, buildIncomeForRanges, type IsoRange } from '../erstatningsopgoerelse/helpers/indtaegtPerioder';
import { clampTafRange, getValidTafRange, resolveTafConstraintBounds } from '../erstatningsopgoerelse/validation/tafPeriodConstraints';
import { buildFerieDageSetForPeriode, buildShDageSetFromIsoRange } from '../erstatningsopgoerelse/engines/tafDaySets';
import { computeTafArbejdsdageAggregation } from '../erstatningsopgoerelse/engines/tafBeregningsEngine';
import type { SvieSmerteEngineOutput } from '../erstatningsopgoerelse/engines/svieSmerteEngine';
import type { SygeferiegodtgoerelseResult } from '../erstatningsopgoerelse/engines/sfggResult';
import type { EoCanonicalOutput } from '../erstatningsopgoerelse/snapshot/eoCanonicalOutput';
import {
  beregnetVaerdi,
  buildSammentaellingControl,
  grundlagMangler,
  type SammentaellingControl,
  type SammentaellingDisplayRow,
} from '../erstatningsopgoerelse/control/eoControlMismatch';

export type SvieSmerteContext = Readonly<{
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  menAfgoerelseDatoForTabel: ISODateString | undefined;
  verserendeKlageMen: boolean;
}>;

export type TaftContext = Readonly<{
  skadedatoISO: ISODateString | undefined;
  erErhvervssygdom: boolean;
  endeligEETBeregnetDato: ISODateString | undefined;
  differencekravDato: ISODateString | undefined;
  verserendeKlageEet: boolean;
}>;

export type SammentaellingModel = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  beregningsperiode: SammentaellingControl;
  taf: SammentaellingControl;
  svieSmerteSygedage: SammentaellingControl;
  svieSmerteDelvise: SammentaellingControl;
  sfgg: SammentaellingControl;
  beregningsperiodeIndtaegter: readonly SammentaellingDisplayRow[];
  tafIndtaegter: readonly SammentaellingDisplayRow[];
}>;

export const buildSvieSmerteContext = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues
): SvieSmerteContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const menAfgoerelseDatoForTabel =
    eoValues.varigeMenAfgorelse === 'Ja' ? getDayBeforeIso(eoValues.menAfgoerelseDato) : undefined;
  const verserendeKlageMen = eoValues.verserendeKlageMen === 'Ja';

  return {
    skadedatoISO: stamdataValues.skadedato,
    erErhvervssygdom,
    menAfgoerelseDatoForTabel,
    verserendeKlageMen,
  };
};

export const buildTaftContext = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues
): TaftContext => {
  const erErhvervssygdom = stamdataValues.skadestype === 'Erhvervssygdom';
  const endeligEETBeregnetDato =
    eoValues.endeligtEETAfgorelse === 'Ja'
      ? eoValues.endeligEETVirkningsdato || eoValues.endeligEETAfgoerelseDato
      : undefined;
  const verserendeKlageEet = eoValues.verserendeKlageEet === 'Ja';

  return {
    skadedatoISO: stamdataValues.skadedato,
    erErhvervssygdom,
    endeligEETBeregnetDato,
    differencekravDato: eoValues.differencekravDato,
    verserendeKlageEet,
  };
};

export type SammentaellingDisplayTables = Readonly<{
  basis: readonly SammentaellingDisplayRow[];
  beregningsperiode: readonly SammentaellingDisplayRow[];
  taf: readonly SammentaellingDisplayRow[];
  sfgg: readonly SammentaellingDisplayRow[];
}>;

export const buildSammentaellingDisplayTables = (model: SammentaellingModel): SammentaellingDisplayTables => {
  const formatCount = (value: number | null | undefined): string => {
    const resolved = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return formatAsAmountTrimmed(resolved, 0);
  };
  const ferieShPrefix = model.beregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'inkl.' : '-';
  const beregningsFerieDageTilLabel =
    model.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? (model.beregningsperiode.dateredeFerieDageCount ?? model.beregningsperiode.ferieDageCount)
      : model.beregningsperiode.ferieDageCount;
  const tafFerieDageTilLabel =
    model.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      ? (model.taf.dateredeFerieDageCount ?? model.taf.ferieDageCount)
      : model.taf.ferieDageCount;
  const beregningsLoseFerieTilLabel = typeof model.beregningsperiode.loseFerieDageCount === 'number'
    ? Math.max(0, model.beregningsperiode.loseFerieDageCount)
    : 0;
  const tafLoseFerieTilLabel = typeof model.taf.loseFerieDageCount === 'number'
    ? Math.max(0, model.taf.loseFerieDageCount)
    : 0;
  const beregningsOevrigtTilLabel = Math.max(0, model.beregningsperiode.oevrigeFravaersdage);
  const beregningsEkstraSuffix = (() => {
    const samletLoseOgFravaer = beregningsLoseFerieTilLabel + beregningsOevrigtTilLabel;
    return samletLoseOgFravaer > 0 ? ` (- ${formatCount(samletLoseOgFravaer)} løse ferie- og fraværsdage)` : '';
  })();
  const tafEkstraSuffix = tafLoseFerieTilLabel > 0
    ? ` (- ${formatCount(tafLoseFerieTilLabel)} løse feriedage)`
    : '';

  const beregningsperiodeLabel =
    `Arbejdsdage i beregningsperiode (${ferieShPrefix} ${formatCount(beregningsFerieDageTilLabel)} feriedage og ${formatCount(model.beregningsperiode.shDageCount)} SH-dage)${beregningsEkstraSuffix}`;

  const tafLabel =
    `Arbejdsdage i TAF-periode (${ferieShPrefix} ${formatCount(tafFerieDageTilLabel)} feriedage og ${formatCount(model.taf.shDageCount)} SH-dage)${tafEkstraSuffix}`;

  const basisRows: SammentaellingDisplayRow[] = [
    {
      key: 'arbejdsdage-beregning',
      label: beregningsperiodeLabel,
      control: model.beregningsperiode,
    },
    {
      key: 'arbejdsdage-taf',
      label: tafLabel,
      control: model.taf,
    },
    {
      key: 'svie-smerte-sygedage',
      label: 'Svie/smerte, sygedage',
      control: model.svieSmerteSygedage,
    },
    {
      key: 'svie-smerte-delvise',
      label: 'Svie/smerte, delvise sygedage',
      control: model.svieSmerteDelvise,
    },
  ];

  return {
    basis: basisRows,
    beregningsperiode: model.beregningsperiodeIndtaegter,
    taf: model.tafIndtaegter,
    sfgg: [
      {
        key: 'sfgg',
        label: 'Sygeferiegodtgørelse',
        control: model.sfgg,
      },
    ],
  };
};

export const flattenSammentaellingDisplayTables = (
  tables: SammentaellingDisplayTables
): readonly SammentaellingDisplayRow[] => {
  return [...tables.basis, ...tables.beregningsperiode, ...tables.taf, ...tables.sfgg];
};

/**
 * Lokal hjælper: returnerer et IsoRange-objekt eller null hvis perioden er ugyldig.
 *
 * NB: Ikke det samme som `getIsoRange` fra `dateUtils`, som genererer et
 * array af alle dage i et interval. Denne funktion validerer blot perioden og
 * returnerer den som et typet objekt.
 */
const toIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): Readonly<{ fra: ISODateString; til: ISODateString }> | null => {
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { fra, til };
};

const buildShDatesInRange = (
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();
  return buildShDageSetFromIsoRange(range.fra, range.til);
};

const buildFerieDatesInRange = (
  values: ErstatningsopgoerelseValues,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null,
  options?: Readonly<{ includeTafLoseFeriedage?: boolean; includeBeregningsperiodeLoseFeriedage?: boolean }>
): ReadonlySet<ISODateString> => {
  if (!range) return new Set<ISODateString>();

  const ferieperioder = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  const includeTafLoseFeriedage = options?.includeTafLoseFeriedage === true;
  const includeBeregningsperiodeLoseFeriedage = options?.includeBeregningsperiodeLoseFeriedage === true;
  const beregningsperiodeLoseFeriedage =
    includeBeregningsperiodeLoseFeriedage && typeof values.uspecificeredeFerieFridage === 'number'
      ? Math.max(0, Math.trunc(values.uspecificeredeFerieFridage))
      : 0;

  const loseFerieSources: Array<{ fra?: ISODateString; til?: ISODateString; loseFeriedage?: number }> = [];
  if (includeTafLoseFeriedage) {
    loseFerieSources.push(...(values.tafPerioder ?? []));
  }
  if (includeBeregningsperiodeLoseFeriedage && beregningsperiodeLoseFeriedage > 0) {
    loseFerieSources.push({
      fra: range.fra,
      til: range.til,
      loseFeriedage: beregningsperiodeLoseFeriedage,
    });
  }

  return buildFerieDageSetForPeriode(
    { ferieperioder, tafPerioder: loseFerieSources },
    range.fra,
    range.til
  );
};

const formatDaInt = (value: number): string => formatAsAmountTrimmed(value, 0);

const formatOptionalInt = (value: number | null): string => (value === null || value === 0 ? '-' : formatDaInt(value));

const formatOptionalAmount = (value: number | null): string =>
  value === null || value === 0 ? '-' : formatCurrency(value);

const parseDanishNumberString = (value: string): number | null => parseCanonicalDanishNumberString(value) ?? null;

const buildRangeMask = (dates: readonly ISODateString[], ranges: readonly IsoRange[]): readonly boolean[] => {
  if (ranges.length === 0) return [];
  return dates.map((iso) => ranges.some((range) => iso >= range.fra && iso <= range.til));
};

const sumKontrolTableColumnInRanges = (
  model: EOInspektionModel,
  columnId: string,
  ranges: readonly IsoRange[]
): { sum: number | null; hasColumn: boolean } => {
  if (model.rowCount === 0) return { sum: null, hasColumn: false };
  const hasColumn = model.columns.some((col) => col.id === columnId);
  if (!hasColumn) return { sum: null, hasColumn: false };
  if (ranges.length === 0) return { sum: null, hasColumn: true };

  const mask = buildRangeMask(model.tableData.dates, ranges);
  if (mask.length === 0) return { sum: null, hasColumn: true };

  const raw = model.columnRawValues.get(columnId as never);
  if (raw) {
    let sum = 0;
    let hasValue = false;
    for (let i = 0; i < raw.length; i += 1) {
      if (!mask[i]) continue;
      const value = raw[i] ?? 0;
      if (value === 0) continue;
      sum += value;
      hasValue = true;
    }
    return { sum: hasValue ? sum : null, hasColumn: true };
  }

  let sum = 0;
  let hasValue = false;
  for (let rowIndex = 0; rowIndex < model.rowCount; rowIndex += 1) {
    if (!mask[rowIndex]) continue;
    const cell = model.getCell(rowIndex, columnId as never);
    const trimmed = String(cell ?? '').trim();
    if (trimmed === '' || trimmed === '-') continue;
    const parsed = parseDanishNumberString(trimmed);
    if (parsed === null) continue;
    sum += parsed;
    hasValue = true;
  }

  return { sum: hasValue ? sum : null, hasColumn: true };
};

const countArbejdsdageInRange = (
  model: EOInspektionModel,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): number | null => {
  if (!range || model.rowCount === 0) return null;
  let count = 0;
  for (let i = 0; i < model.tableData.dates.length; i += 1) {
    const iso = model.tableData.dates[i];
    if (iso < range.fra || iso > range.til) continue;
    if (model.tableData.isWorkdayByIndex[i]) count += 1;
  }
  return count;
};

const countTafDaysFromTable = (model: EOInspektionModel): number | null => {
  if (model.rowCount === 0) return null;
  const statuses = model.tableData.tafDayStatusByIndex;
  if (statuses.length === 0) return null;

  let count = 0;
  let hasVisibleStatus = false;
  for (const status of statuses) {
    if (status === '') continue;
    hasVisibleStatus = true;
    if (status === 'Ja') count += 1;
  }

  return hasVisibleStatus ? count : null;
};

const countSvieSmerteFromTable = (
  model: EOInspektionModel,
  range: Readonly<{ fra: ISODateString; til: ISODateString }> | null
): Readonly<{ sygedage: number; delviseSygedage: number }> | null => {
  if (!range || model.rowCount === 0) return null;
  let sygedage = 0;
  let delviseSygedage = 0;
  for (let i = 0; i < model.tableData.dates.length; i += 1) {
    const iso = model.tableData.dates[i];
    if (iso < range.fra || iso > range.til) continue;
    const cell = model.tableData.ssStatusByIndex[i];
    if (cell === 'Ja') sygedage += 1;
    if (cell === 'Delvis') delviseSygedage += 1;
  }
  return { sygedage, delviseSygedage };
};

export const buildEOInspektionSammentaellingModel = (args: {
  values: ErstatningsopgoerelseValues;
  model: EOInspektionModel;
  svieSmerteContext: SvieSmerteContext;
  taftContext: TaftContext;
  tafRanges?: readonly IsoRange[];
  canonicalOutput?: EoCanonicalOutput;
  sfggResult?: SygeferiegodtgoerelseResult;
  /** Autoritativt svie/smerte-engine-output fra EO-snapshot. Når tilstede bruges dette
   *  direkte i stedet for et nyt kald – sikrer at sammentællingen bruger præcis
   *  det samme resultat som beregningen. */
  svieSmerteEngine?: SvieSmerteEngineOutput;
}): SammentaellingModel => {
  const { values, model } = args;

  const beregningsenhed = computeTafBeregningsenhed(values);
  const isBeregningsperiode = values.beregnesUdFra === 'Beregningsperiode';
  const isTafEnabled = values.kravPaaTabtArbejdsfortjeneste === 'Ja';
  const isSvieSmerteEnabled = values.kravPaaSvieSmerteGodtgoerelse === 'Ja';

  const beregningsRange = toIsoRange(values.tafBeregningsperiodeFra, values.tafBeregningsperiodeTil);
  const erstatningsRange = toIsoRange(values.vedroererPeriodeFra, values.vedroererPeriodeTil);

  const beregningsFerieDates = buildFerieDatesInRange(values, beregningsRange, {
    includeBeregningsperiodeLoseFeriedage: true,
    includeTafLoseFeriedage: false,
  });
  const beregningsDateredeFerieDates = buildFerieDatesInRange(values, beregningsRange, {
    includeBeregningsperiodeLoseFeriedage: false,
    includeTafLoseFeriedage: false,
  });
  const beregningsShDates = buildShDatesInRange(beregningsRange);
  const beregningsDateredeFerieDageCount = beregningsDateredeFerieDates.size;
  const beregningsFerieDageCount = beregningsFerieDates.size;
  const beregningsLoseFerieDageCount = Math.max(0, beregningsFerieDageCount - beregningsDateredeFerieDageCount);
  const beregningsShDageCount = beregningsShDates.size;

  const tafBounds = resolveTafConstraintBounds(values, { skadedatoISO: args.taftContext.skadedatoISO });
  const tafFerieDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildFerieDatesInRange(values, range, {
        includeTafLoseFeriedage: true,
        includeBeregningsperiodeLoseFeriedage: false,
      });
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafDateredeFerieDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildFerieDatesInRange(values, range, {
        includeTafLoseFeriedage: false,
        includeBeregningsperiodeLoseFeriedage: false,
      });
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafShDates = (() => {
    const collected = new Set<ISODateString>();
    for (const periode of values.tafPerioder ?? []) {
      const validRange = getValidTafRange(periode);
      if (!validRange) continue;
      const range = clampTafRange(validRange, tafBounds);
      if (!range) continue;
      const set = buildShDatesInRange(range);
      set.forEach((iso) => collected.add(iso));
    }
    return collected;
  })();
  const tafDateredeFerieDageCount = tafDateredeFerieDates.size;
  const tafFerieDageCount = tafFerieDates.size;
  const tafLoseFerieDageCount = Math.max(0, tafFerieDageCount - tafDateredeFerieDageCount);
  const tafShDageCount = tafShDates.size;

  /**
   * Er beregningsperioden et FÆRDIGT og indbyrdes gyldigt input?
   *
   * Begge sider af sammentællingskontrollen skal hvile på samme svar. Gjorde de ikke det, blev en
   * helt almindelig indtastningsfejl til en kontroluoverensstemmelse: den beregnede side kunne ikke
   * dannes («-»), mens tabelsiden uanfægtet talte arbejdsdage videre. En uoverensstemmelse mellem
   * «intet tal» og «263» er ikke to opgørelser, der er uenige – det er ÉN opgørelse, der mangler.
   *
   * Brugerfund 2026-09-17: en beregningsperiode, der slutter samme dag som TAF-perioden begynder
   * (01-03-2024 i begge ender), er et overlap. Fejlen er allerede fortalt brugeren som en rød række
   * («Der er overlap mellem beregningsperioden ... og en TAF-periode», `eoRowTafBeregningsgrundlagRows`),
   * og den blokerer downloaden ad den vej. Asymmetrien her lagde ovenikøbet
   * `control:sammentaelling_mismatch` oven på – en SYSTEMFEJL, der åbnede notitsen «Teknisk fejl
   * registreret» og pegede brugeren mod en kodefejl frem for mod sin egen dato.
   */
  const erBeregningsperiodeInputKlar = (() => {
    if (values.beregnesUdFra !== 'Beregningsperiode') return false;

    const periodeFra = values.tafBeregningsperiodeFra;
    const periodeTil = values.tafBeregningsperiodeTil;
    if (!periodeFra || !periodeTil) return false;
    if (periodeFra > periodeTil) return false;

    const overlap = computeTafOverlapWithBeregningsperiode({
      beregningsperiode: { fra: periodeFra, til: periodeTil },
      tafPerioder: (values.tafPerioder ?? []).map((periode) => ({
        id: periode.id,
        fra: periode.fra,
        til: periode.til,
      })),
    });
    if (overlap.firstOverlapMessage) return false;

    if (values.oevrigtFravaerUdenLoen === 'Ja' && values.oevrigeFravaersdage === undefined) {
      return false;
    }

    return true;
  })();

  // Samme input-gate som den beregnede side: er beregningsperioden ikke et gyldigt input, findes der
  // heller ikke et meningsfuldt tabeltal at holde den op imod. Se `erBeregningsperiodeInputKlar`.
  const beregningsArbejdsdage = erBeregningsperiodeInputKlar
    ? countArbejdsdageInRange(model, beregningsRange)
    : null;
  const tafArbejdsdageFromTable = isTafEnabled ? countTafDaysFromTable(model) : null;
  const svieSmerteTabelCounts = isSvieSmerteEnabled ? countSvieSmerteFromTable(model, erstatningsRange) : null;

  // Sammentællingen må kun vise autoritative svie/smerte-tal fra snapshot-pipelinen.
  // Hvis engine-output ikke er leveret, vises ingen beregnet værdi.
  const svieSmerteEngineCounts = isSvieSmerteEnabled
    ? (args.svieSmerteEngine ?? null)
    : null;

  const svieSmerteResolvedCounts = svieSmerteEngineCounts
    ? { sygedage: svieSmerteEngineCounts.sygedage, delviseSygedage: svieSmerteEngineCounts.delviseSygedage }
    : null;

  const tafBeregnetDays = isTafEnabled
    ? computeTafArbejdsdageAggregation({
      erstatningsopgoerelse: values,
      tafPerioder: values.tafPerioder ?? [],
      ferieperioder: values.ferieperioder ?? [],
      beregningsenhed,
      tafRanges: args.tafRanges,
      skadedatoISO: args.taftContext.skadedatoISO,
    })
    : null;

  const beregningsperiodeArbejdsdage = (() => {
    if (!erBeregningsperiodeInputKlar) return null;

    const periodeFra = values.tafBeregningsperiodeFra;
    const periodeTil = values.tafBeregningsperiodeTil;
    if (!periodeFra || !periodeTil) return null;

    const beregningsFerieperioder = values.fravaerPerioder ?? [];
    const oevrigeFravaersdageValue =
      values.oevrigtFravaerUdenLoen === 'Ja' && typeof values.oevrigeFravaersdage === 'number'
        ? values.oevrigeFravaersdage
        : 0;
    const breakdown = calculateTafArbejdsdageBreakdown(
      periodeFra,
      periodeTil,
      beregningsFerieperioder,
      typeof values.uspecificeredeFerieFridage === 'number' ? values.uspecificeredeFerieFridage : 0,
      { kind: 'beregningsgrundlag', oevrigeFravaersdage: oevrigeFravaersdageValue }
    );
    if (!breakdown) return null;

    // Systematik:
    // - Måneder: beregnet værdi i sammentælling er rene hverdage (ingen fradrag).
    // - Arbejdsdage: beregnet værdi er hverdage minus SH/ferie/løse ferie/øvrigt fravær.
    if (beregningsenhed === TAF_BEREGNES_SOM.MAANEDER) {
      return Math.max(0, breakdown.arbejdsdage);
    }
    return Math.max(0, breakdown.tafDage);
  })();

  const beregningsLoseFeriedage = beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? beregningsLoseFerieDageCount
    : 0;
  const beregningsOevrigeFravaersdage =
    beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
      && values.oevrigtFravaerUdenLoen === 'Ja'
      && typeof values.oevrigeFravaersdage === 'number'
      ? values.oevrigeFravaersdage
      : 0;
  const beregningsTabelFradrag = beregningsLoseFeriedage + beregningsOevrigeFravaersdage;

  const tafLoseFeriedage = (values.tafPerioder ?? []).reduce((sum, row) => {
    const validRange = getValidTafRange(row);
    if (!validRange) return sum;
    const range = clampTafRange(validRange, tafBounds);
    if (!range) return sum;
    const next = typeof row.loseFeriedage === 'number' ? row.loseFeriedage : 0;
    return sum + next;
  }, 0);
  const tafLoseFeriedageForControl = isTafEnabled && beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE ? tafLoseFeriedage : 0;
  const tafTabelFradrag = tafLoseFeriedageForControl;

  const withTabelFradragDisplay = (tableValue: number | null, fradrag: number): string => {
    const base = formatOptionalInt(tableValue);
    if (tableValue === null || fradrag <= 0) return base;
    return `${base} (- ${formatDaInt(fradrag)})`;
  };

  const applyTabelFradrag = (tableValue: number | null, fradrag: number): number | null => {
    if (tableValue === null) return null;
    return Math.max(0, tableValue - fradrag);
  };

  const beregningsTabelDisplay = withTabelFradragDisplay(beregningsArbejdsdage, beregningsTabelFradrag);
  const tafTabelDisplay = withTabelFradragDisplay(tafArbejdsdageFromTable, tafTabelFradrag);
  const beregningsTabelValueForControl = applyTabelFradrag(beregningsArbejdsdage, beregningsTabelFradrag);
  const tafTabelValueForControl = applyTabelFradrag(tafArbejdsdageFromTable, tafTabelFradrag);
  const sfggBeregnetOre = args.canonicalOutput?.taf.sygeferiegodtgoerelseOre ?? null;
  const sfggTabelOre = args.sfggResult
    ? args.sfggResult.perAnsaettelsesforhold.reduce((sum, entry) => sum + entry.totalOre, 0)
    : null;

  const beregningsperiodeRange = isBeregningsperiode ? buildBeregningsperiodeRange(values) : undefined;
  const beregningsperiodeRanges = beregningsperiodeRange ? [beregningsperiodeRange] : [];
  // tafRanges skal altid leveres fra engines (clampede); tom liste ved validerings-fejl-sti.
  const tafRanges = isTafEnabled ? (args.tafRanges ?? []) : [];

  const buildIndtaegtEntries = (ranges: readonly IsoRange[], scopeLabel: string): SammentaellingDisplayRow[] => {
    const income = buildIncomeForRanges(values, ranges);
    const entries: SammentaellingDisplayRow[] = [];

    income.employers.forEach((entry, index) => {
      const baseLabel = index === 0 ? 'Ansættelsesforhold' : `Ansættelsesforhold ${index + 1}`;
      const navn = entry.name.trim();
      const label = navn !== '' ? `${baseLabel} (${navn})` : baseLabel;
      const columnId = kontrolTabelColumnId.loenWage(entry.index, 'samlet');
      const tabel = sumKontrolTableColumnInRanges(model, columnId, ranges);
      entries.push({
        key: `sammentaelling.${scopeLabel}.loen.${entry.id}`,
        label,
        control: buildSammentaellingControl({
          beregnet: beregnetVaerdi(entry.amount, formatOptionalAmount(entry.amount)),
          tabel: { value: tabel.sum, display: formatOptionalAmount(tabel.sum) },
        }),
      });
    });

    income.benefits.forEach((entry) => {
      const columnId = entry.typeKey ? kontrolTabelColumnId.offentlig(entry.typeKey) : '';
      const tabel = columnId !== '' ? sumKontrolTableColumnInRanges(model, columnId, ranges) : { sum: null, hasColumn: false };
      entries.push({
        key: `sammentaelling.${scopeLabel}.ydelse.${entry.typeKey || entry.label}`,
        label: entry.label,
        control: buildSammentaellingControl({
          beregnet: beregnetVaerdi(entry.amount, formatOptionalAmount(entry.amount)),
          tabel: { value: tabel.sum, display: formatOptionalAmount(tabel.sum) },
        }),
      });
    });

    return entries;
  };

  const buildTafHypotetiskIndkomstEntries = (): SammentaellingDisplayRow[] => {
    const offentligeYdelserUdviklingOre = args.canonicalOutput?.taf.offentligeYdelserUdviklingOre ?? null;
    if (offentligeYdelserUdviklingOre === null) return [];
    const amount = offentligeYdelserUdviklingOre / 100;
    return [{
      key: 'sammentaelling.taf.offentligeYdelserUdvikling',
      label: 'Offentlige ydelser',
      control: buildSammentaellingControl({
        beregnet: beregnetVaerdi(amount, formatOptionalAmount(amount)),
        tabel: { value: amount, display: formatOptionalAmount(amount) },
      }),
    }];
  };

  const tafIndtaegter = [
    ...buildIndtaegtEntries(tafRanges, 'taf'),
    ...buildTafHypotetiskIndkomstEntries(),
  ];

  return {
    beregningsenhed,
    beregningsperiode: buildSammentaellingControl({
      // Grundlaget mangler, når beregningsperioden ikke er et gyldigt, færdigt input – fx to
      // perioder der deler en dag, eller et påkrævet fraværsantal der endnu ikke er tastet.
      beregnet: erBeregningsperiodeInputKlar
        ? beregnetVaerdi(beregningsperiodeArbejdsdage, formatOptionalInt(beregningsperiodeArbejdsdage))
        : grundlagMangler,
      // Visningen bærer RÅtallet med fradraget ved siden af; `value` er nettotallet, der sammenlignes.
      tabel: { value: beregningsTabelValueForControl, display: beregningsTabelDisplay },
      loseFeriedage: beregningsLoseFeriedage,
      oevrigeFravaersdage: beregningsOevrigeFravaersdage,
      ferieDageCount: isBeregningsperiode ? beregningsFerieDageCount : 0,
      dateredeFerieDageCount: isBeregningsperiode ? beregningsDateredeFerieDageCount : 0,
      loseFerieDageCount: isBeregningsperiode ? beregningsLoseFerieDageCount : 0,
      shDageCount: isBeregningsperiode ? beregningsShDageCount : 0,
    }),
    taf: buildSammentaellingControl({
      // `computeTafArbejdsdageAggregation` returnerer `null`, når der ikke blev optalt en eneste
      // arbejdsdag – enten fordi ingen TAF-række er brugbar endnu, eller fordi perioden slet ikke
      // rummer en arbejdsdag (fx en ren weekend). Begge dele er «intet at sammenligne», ikke en
      // fejlet opgørelse.
      beregnet: isTafEnabled && tafBeregnetDays !== null
        ? beregnetVaerdi(tafBeregnetDays, formatOptionalInt(tafBeregnetDays))
        : grundlagMangler,
      tabel: { value: tafTabelValueForControl, display: tafTabelDisplay },
      loseFeriedage: tafLoseFeriedageForControl,
      ferieDageCount: isTafEnabled ? tafFerieDageCount : 0,
      dateredeFerieDageCount: isTafEnabled ? tafDateredeFerieDageCount : 0,
      loseFerieDageCount: isTafEnabled ? tafLoseFerieDageCount : 0,
      shDageCount: isTafEnabled ? tafShDageCount : 0,
    }),
    // Uden autoritativt engine-output er der intet beregnet svie/smerte-grundlag. Visningen var
    // allerede symmetrisk («-»/«-»), men VÆRDIERNE var det ikke: tabelsiden bar stadig et tal, så
    // rækken meldte en uoverensstemmelse, INGEN kunne se i tabellen.
    svieSmerteSygedage: buildSammentaellingControl({
      beregnet: svieSmerteResolvedCounts
        ? beregnetVaerdi(svieSmerteResolvedCounts.sygedage, formatOptionalInt(svieSmerteResolvedCounts.sygedage))
        : grundlagMangler,
      tabel: {
        value: svieSmerteTabelCounts?.sygedage ?? null,
        display: formatOptionalInt(svieSmerteTabelCounts?.sygedage ?? null),
      },
    }),
    svieSmerteDelvise: buildSammentaellingControl({
      beregnet: svieSmerteResolvedCounts
        ? beregnetVaerdi(svieSmerteResolvedCounts.delviseSygedage, formatOptionalInt(svieSmerteResolvedCounts.delviseSygedage))
        : grundlagMangler,
      tabel: {
        value: svieSmerteTabelCounts?.delviseSygedage ?? null,
        display: formatOptionalInt(svieSmerteTabelCounts?.delviseSygedage ?? null),
      },
    }),
    // Uden `canonicalOutput` er den autoritative opgørelse slet ikke dannet.
    sfgg: buildSammentaellingControl({
      beregnet: sfggBeregnetOre === null
        ? grundlagMangler
        : beregnetVaerdi(sfggBeregnetOre / 100, formatOptionalAmount(sfggBeregnetOre / 100)),
      tabel: {
        value: sfggTabelOre === null ? null : sfggTabelOre / 100,
        display: formatOptionalAmount(sfggTabelOre === null ? null : sfggTabelOre / 100),
      },
    }),
    beregningsperiodeIndtaegter: buildIndtaegtEntries(beregningsperiodeRanges, 'beregningsperiode'),
    tafIndtaegter,
  };
};
