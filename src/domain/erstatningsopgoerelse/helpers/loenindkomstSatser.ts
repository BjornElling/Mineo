import type {
  LoenindkomstAnsaettelsesforhold,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { coerceToISODateString, danishToISO, isoToDanish, toDanishDateString } from '../../../types/branded';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForDato,
  getOffentligTillaegsSatserForPeriode,
  isOffentligOverenskomstId,
  resolveOverenskomstRef,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { STORE_BEDEDAG_PCT, STORE_BEDEDAG_START } from '../../../config/indskudteLoentillaeg';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import type { StandardLoenRateSegment, StandardLoenSatserInput } from '../../aarsloen/standardLoenRowCalculations';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { round2 } from '../../../utils/roundingShortcuts';
import { generateLoenudviklingRowId, initialLoenudviklingManuelRow } from './eoRowInitialValues';

export type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

// Diskrimineret union: locked === true garanterer et tal. Tidligere var typen
// `{ locked: boolean; value: number | undefined }`, hvilket tillod den umulige tilstand
// `{ locked: true, value: undefined }` og krævede tillidsbaseret value-adgang ved callsites.
export type OverenskomstSatsBinding =
  | Readonly<{ locked: true; value: number }>
  | Readonly<{ locked: false; value: undefined }>;

type OverenskomstSatsBindings = Readonly<Record<OverenskomstSatsField, OverenskomstSatsBinding>>;

type AutoSatsFields = Pick<
  LoenindkomstAnsaettelsesforhold,
  'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
>;

const UNLOCKED_OVERENSKOMST_SATS_BINDINGS: OverenskomstSatsBindings = {
  fritvalgPct: { locked: false, value: undefined },
  shSoPct: { locked: false, value: undefined },
  pensionPct: { locked: false, value: undefined },
};

const resolveBindingFromDecimal = (value: number | null | undefined): OverenskomstSatsBinding => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {
      locked: true,
      value: round2(value * 100),
    };
  }
  return {
    locked: false,
    value: undefined,
  };
};

const resolveStoreBededagPct = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined
): number => {
  if (!anvendtReguleringsdato) return 0;
  return af.loenPaaHelligdage === 'Almindelig løn' && anvendtReguleringsdato >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0;
};

const resolveManualPercentValue = (
  rowValue: string | number | undefined,
  fallback: number | undefined
): number | undefined => {
  if (typeof rowValue === 'number' && Number.isFinite(rowValue)) return round2(rowValue);
  if (typeof rowValue === 'string' && rowValue.trim() !== '') return round2(parsePercentToDecimal(rowValue) * 100);
  return fallback;
};

const resolveLatestManualRowForDate = (
  rows: readonly Readonly<{ row: LoenudviklingManuelRow; startDato: ISODateString }>[],
  isoDate: ISODateString
): LoenudviklingManuelRow | undefined => {
  const matchingEntry = [...rows]
    .reverse()
    .find((entry) => entry.startDato <= isoDate);
  return matchingEntry?.row;
};

const buildSegmentsFromPeriodStarts = (
  fra: ISODateString,
  til: ISODateString,
  starts: readonly ISODateString[]
): readonly Readonly<{ fra: ISODateString; til: ISODateString; startDato: ISODateString }>[] => {
  const boundedStarts = Array.from(new Set([fra, ...starts.filter((start) => start >= fra && start <= til)])).sort();
  return boundedStarts.map((startDato, index) => {
    const nextStart = boundedStarts[index + 1];
    const tilDato = nextStart ? getDayBeforeIso(nextStart) : til;
    return {
      fra: startDato,
      til: tilDato && tilDato < til ? tilDato : til,
      startDato,
    };
  }).filter((segment) => segment.fra <= segment.til);
};

const resolvePeriodSatser = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'overenskomstId' | 'loenPaaHelligdage'>,
  fraDa: ReturnType<typeof toDanishDateString>,
  tilDa: ReturnType<typeof toDanishDateString>
): readonly OverenskomstPeriodeSats[] => {
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId) return [];
  const applyShRegel = af.loenPaaHelligdage === 'Almindelig løn';
  if (isOffentligOverenskomstId(overenskomstId)) {
    return getOffentligTillaegsSatserForPeriode(overenskomstId, fraDa, tilDa, applyShRegel);
  }
  const ref = resolveOverenskomstRef(overenskomstId);
  if (!ref) return [];
  return getEffektiveSatserForPeriode({
    overenskomstId: ref.baseId,
    fraDato: fraDa,
    tilDato: tilDa,
    applyAlmindeligLoenPaaShDageRegel: applyShRegel,
  });
};

export const resolveAutoStoreBededagPct = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined
): number => resolveStoreBededagPct(af, anvendtReguleringsdato);

const resolveOverenskomstSatsBindingsForAnvendtReguleringsdato = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined
): OverenskomstSatsBindings => {
  if (!af.harOverenskomst) return UNLOCKED_OVERENSKOMST_SATS_BINDINGS;
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId || !anvendtReguleringsdato) return UNLOCKED_OVERENSKOMST_SATS_BINDINGS;
  const dato = isoToDanish(anvendtReguleringsdato);
  if (!dato) return UNLOCKED_OVERENSKOMST_SATS_BINDINGS;

  const applyShRegel = af.loenPaaHelligdage === 'Almindelig løn';
  const satser = isOffentligOverenskomstId(overenskomstId)
    ? getOffentligTillaegsSatserForDato(overenskomstId, dato, applyShRegel)
    : (() => {
      const ref = resolveOverenskomstRef(overenskomstId);
      if (!ref) return undefined;
      return getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato,
        applyAlmindeligLoenPaaShDageRegel: applyShRegel,
      });
    })();

  if (!satser) return UNLOCKED_OVERENSKOMST_SATS_BINDINGS;
  return {
    fritvalgPct: resolveBindingFromDecimal(satser.fritvalg),
    shSoPct: resolveBindingFromDecimal(satser.shSoSats),
    pensionPct: resolveBindingFromDecimal(satser.agPension),
  };
};

export const resolveOverenskomstSatsBindings = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined
): OverenskomstSatsBindings =>
  resolveOverenskomstSatsBindingsForAnvendtReguleringsdato(af, anvendtReguleringsdato);

export const isOverenskomstSatsFieldLocked = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined,
  field: OverenskomstSatsField
): boolean => resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[field].locked;

const resolveAutoSatsFields = (
  af: Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'
    | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
  >,
  anvendtReguleringsdato: ISODateString | undefined
): AutoSatsFields => {
  const autoStoreBededag = resolveAutoStoreBededagPct(af, anvendtReguleringsdato);
  const autoSatser = resolveOverenskomstSatsBindings(af, anvendtReguleringsdato);

  return {
    fritvalgPct: autoSatser.fritvalgPct.locked ? autoSatser.fritvalgPct.value : af.fritvalgPct,
    shSoPct: autoSatser.shSoPct.locked ? autoSatser.shSoPct.value : af.shSoPct,
    storeBededagPct: autoStoreBededag,
    pensionPct: autoSatser.pensionPct.locked ? autoSatser.pensionPct.value : af.pensionPct,
  };
};

export const applyAutoSatsFields = <
  T extends Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'
    | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
  >,
>(
  af: T,
  anvendtReguleringsdato: ISODateString | undefined
): T => ({
  ...af,
  ...resolveAutoSatsFields(af, anvendtReguleringsdato),
});

export const buildLoenindkomstRateSegments = (args: Readonly<{
  ansaettelsesforhold: Pick<
    LoenindkomstAnsaettelsesforhold,
    | 'feriePct'
    | 'fritvalgPct'
    | 'shSoPct'
    | 'storeBededagPct'
    | 'pensionPct'
    | 'loenudviklingBeregningsgrundlag'
    | 'loenudviklingManuelTableData'
    | 'harOverenskomst'
    | 'overenskomstId'
    | 'loenPaaHelligdage'
  >;
  skadedato: ISODateString | undefined;
  fra: ISODateString;
  til: ISODateString;
}>): readonly StandardLoenRateSegment[] => {
  const { ansaettelsesforhold: af, skadedato: _skadedato, fra, til } = args;
  // Decision note: basisstien må ikke være afhængig af at callsites altid har kørt
  // applyAutoSatsFields først. Store Bededag er datoafhængig og udledes derfor
  // fail-closed direkte her ud fra segmentets startdato.
  const baseSatser: StandardLoenSatserInput = {
    feriePct: af.feriePct,
    fritvalgPct: af.fritvalgPct,
    shSoPct: af.shSoPct,
    storeBededagPct: resolveStoreBededagPct(af, fra),
    pensionPct: af.pensionPct,
  };

  if (af.loenudviklingBeregningsgrundlag === 'Manuelt angivet') {
    const rows = (af.loenudviklingManuelTableData ?? [])
      .map((row) => {
        const startDato = coerceToISODateString(row.dato);
        return startDato ? { row, startDato } : null;
      })
      .filter((entry): entry is Readonly<{ row: LoenudviklingManuelRow; startDato: ISODateString }> => entry !== null)
      .sort((left, right) => left.startDato.localeCompare(right.startDato));
    const starts = rows
      .map((entry) => entry.startDato)
      .filter((startDato) => startDato >= fra && startDato <= til);
    return buildSegmentsFromPeriodStarts(fra, til, starts).map((segment) => {
      const row = resolveLatestManualRowForDate(rows, segment.startDato);
      return {
        fra: segment.fra,
        til: segment.til,
        satser: {
          feriePct: resolveManualPercentValue(row?.feriepenge, af.feriePct),
          fritvalgPct: resolveManualPercentValue(row?.fritvalg, af.fritvalgPct),
          shSoPct: resolveManualPercentValue(row?.shSoSats, af.shSoPct),
          storeBededagPct: resolveStoreBededagPct(af, segment.startDato),
          pensionPct: resolveManualPercentValue(row?.agPension, af.pensionPct),
        },
      };
    });
  }

  if (!af.harOverenskomst || !af.overenskomstId?.trim()) {
    return [{ fra, til, satser: baseSatser }];
  }

  const fraDa = isoToDanish(fra);
  const tilDa = isoToDanish(til);
  if (!fraDa || !tilDa) {
    return [{ fra, til, satser: baseSatser }];
  }

  const periodSatser = resolvePeriodSatser(af, fraDa, tilDa);
  const starts = periodSatser
    .map((sats) => danishToISO(sats.fraDato))
    .filter((start): start is ISODateString => start !== undefined)
    .filter((start) => start >= fra && start <= til);

  return buildSegmentsFromPeriodStarts(fra, til, starts).map((segment) => {
    const auto = resolveOverenskomstSatsBindingsForAnvendtReguleringsdato(af, segment.startDato);
    return {
      fra: segment.fra,
      til: segment.til,
      satser: {
        feriePct: af.feriePct,
        fritvalgPct: auto.fritvalgPct.locked ? auto.fritvalgPct.value : af.fritvalgPct,
        shSoPct: auto.shSoPct.locked ? auto.shSoPct.value : af.shSoPct,
        storeBededagPct: resolveStoreBededagPct(af, segment.startDato),
        pensionPct: auto.pensionPct.locked ? auto.pensionPct.value : af.pensionPct,
      },
    };
  });
};

const formatManualBaseRowPercent = (value: number | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
};

/**
 * Synkroniserer de auto-udledte satser (ferie/SH-SO/fritvalg/pension) ind i den manuelle
 * lønudviklings-baserække, så base-rækken altid afspejler ansættelsesforholdets satser.
 *
 * Domænelogik (ikke præsentation): flyttet fra LoenindkomstTab, så den kan genbruges og
 * testes uafhængigt af UI-laget.
 */
export const syncManualBaseRowSatser = (af: LoenindkomstAnsaettelsesforhold): LoenindkomstAnsaettelsesforhold => {
  if (af.loenudviklingBeregningsgrundlag !== 'Manuelt angivet') return af;
  // Beløb-tilstand: basisrækkens tillægsprocenter er brugerindtastede og erstatter
  // satsfelterne ovenfor, som er skjulte. De må derfor aldrig overskrives af skjulte satsværdier.
  if (af.tillaegAngivesSom === 'beloeb') return af;

  const currentRows = af.loenudviklingManuelTableData ?? [];
  const currentBaseRow = currentRows[0]
    ?? { ...initialLoenudviklingManuelRow, id: generateLoenudviklingRowId() };

  const nextBaseRow = {
    ...currentBaseRow,
    feriepenge: formatManualBaseRowPercent(af.feriePct),
    shSoSats: formatManualBaseRowPercent(af.shSoPct),
    fritvalg: formatManualBaseRowPercent(af.fritvalgPct),
    agPension: formatManualBaseRowPercent(af.pensionPct),
  };

  const hasBaseRowChanged =
    currentBaseRow.feriepenge !== nextBaseRow.feriepenge ||
    currentBaseRow.shSoSats !== nextBaseRow.shSoSats ||
    currentBaseRow.fritvalg !== nextBaseRow.fritvalg ||
    currentBaseRow.agPension !== nextBaseRow.agPension;

  if (!hasBaseRowChanged && currentRows.length > 0) return af;

  return {
    ...af,
    loenudviklingManuelTableData: [nextBaseRow, ...currentRows.slice(1)],
  };
};
