import type {
  LoenindkomstAnsaettelsesforhold,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { coerceToISODateString, danishToISO, isoToDanish, toDanishDateString } from '../../../types/branded';
import {
  getEffektiveSatserForPeriode,
  getOffentligTillaegsSatserForPeriode,
  isOffentligOverenskomstId,
  resolveOverenskomstRef,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { resolveStoreBededagstillaegPct } from '../../loen/storeBededagstillaeg';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import type { StandardLoenRateSegment, StandardLoenSatserInput } from '../../aarsloen/standardLoenRowCalculations';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { findLatestByDateKeyInSortedList } from '../engines/reguleringSeriesLookup';
import { round2 } from '../../../utils/roundingShortcuts';
import { generateLoenudviklingRowId, initialLoenudviklingManuelRow } from './eoRowInitialValues';
import { harAktivOverenskomst } from '../../loen/aktivOverenskomst';
import { hasIndtastetLoenoplysninger } from './loenoplysningerInput';

import {
  resolveOverenskomstSatsBindings,
  resolvePrivatOverenskomstDaekning,
  erDatoUdenOverenskomstSatser,
  resolveSatsForReguleringsdato,
  type OverenskomstSatsBinding,
} from '../../loen/overenskomstSatser';

type AutoSatsFields = Pick<
  LoenindkomstAnsaettelsesforhold,
  'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
>;

/**
 * Satsen, en LØNRÆKKE regner med i et segment. Et utilgængeligt opslag regnes bevidst som 0: lønrækker før
 * overenskomstens første satsperiode får ingen overenskomsttillæg og en gul advarsel (udviklerafgørelse
 * 2026-10-06). Ligger selve reguleringsdatoen før dækningen, er beregningen i stedet spærret.
 */
const resolveSatsForSegment = (binding: OverenskomstSatsBinding, brugerValue: number | undefined): number | undefined => {
  switch (binding.kind) {
    case 'overenskomst': return binding.value;
    case 'utilgaengelig': return 0;
    case 'bruger': return brugerValue;
  }
};

const resolveStoreBededagPct = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage' | 'beregnStoreBededagstillaeg'>,
  anvendtReguleringsdato: ISODateString | undefined
): number => resolveStoreBededagstillaegPct(anvendtReguleringsdato, af);

const resolveManualPercentValue = (
  rowValue: string | number | undefined,
  fallback: number | undefined
): number | undefined => {
  if (typeof rowValue === 'number' && Number.isFinite(rowValue)) return round2(rowValue);
  if (typeof rowValue === 'string' && rowValue.trim() !== '') return round2(parsePercentToDecimal(rowValue) * 100);
  return fallback;
};

/**
 * Carry-forward-opslag i de manuelle lønudviklings-rækker: seneste række med
 * `startDato <= isoDate` gælder frem til næste.
 *
 * Semantikken ejes af `reguleringSeriesLookup` – også sorterings-invarianten, der får et
 * usorteret input til at kaste frem for tavst at give et forkert sats-sæt. Et lokalt
 * `[...rows].reverse().find(...)` ville miste netop den invariant.
 * Feltet heder `startDato` her, derfor nøglevælger-formen frem for et felt-omdøb i skemaet.
 */
const resolveLatestManualRowForDate = (
  rows: readonly Readonly<{ row: LoenudviklingManuelRow; startDato: ISODateString }>[],
  isoDate: ISODateString
): LoenudviklingManuelRow | undefined =>
  findLatestByDateKeyInSortedList(rows, isoDate, (entry) => entry.startDato, 'loenudviklingManuel:satser')?.row;

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
  af: Pick<LoenindkomstAnsaettelsesforhold, 'loenPaaHelligdage' | 'beregnStoreBededagstillaeg'>,
  anvendtReguleringsdato: ISODateString | undefined
): number => resolveStoreBededagPct(af, anvendtReguleringsdato);

/**
 * Meldes reguleringsdatoen allerede som uden overenskomstsatser for kortet? Det gør den, når satserne faktisk
 * bruges – procent-tilstand og indtastede lønoplysninger – og en privat overenskomst ikke dækker datoen
 * (`buildOverenskomstSatsDaekningRows`, BB-275). Lønudviklingens dækningsregel bruger svaret til ikke at melde
 * samme problem en gang til (udviklerafgørelse 2026-10-23, BB-306).
 */
export const erReguleringsdatoUdenOverenskomstSatserMeldt = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'tillaegAngivesSom' | 'indtaegtsoplysningerTableData'>,
  reguleringsdato: ISODateString,
): boolean => {
  if (af.tillaegAngivesSom === 'beloeb' || !hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? [])) return false;
  const daekning = resolvePrivatOverenskomstDaekning(af);
  return daekning !== null && erDatoUdenOverenskomstSatser(daekning, reguleringsdato);
};

const resolveAutoSatsFields = (
  af: Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage' | 'beregnStoreBededagstillaeg'
    | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
  >,
  anvendtReguleringsdato: ISODateString | undefined
): AutoSatsFields => {
  const autoStoreBededag = resolveAutoStoreBededagPct(af, anvendtReguleringsdato);
  const autoSatser = resolveOverenskomstSatsBindings(af, anvendtReguleringsdato);

  return {
    fritvalgPct: resolveSatsForReguleringsdato(autoSatser.fritvalgPct, af.fritvalgPct),
    shSoPct: resolveSatsForReguleringsdato(autoSatser.shSoPct, af.shSoPct),
    storeBededagPct: autoStoreBededag,
    pensionPct: resolveSatsForReguleringsdato(autoSatser.pensionPct, af.pensionPct),
  };
};

export const applyAutoSatsFields = <
  T extends Pick<
    LoenindkomstAnsaettelsesforhold,
    'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage' | 'beregnStoreBededagstillaeg'
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
    | 'beregnStoreBededagstillaeg'
  >;
  skadedato: ISODateString | undefined;
  fra: ISODateString;
  til: ISODateString;
}>): readonly StandardLoenRateSegment[] => {
  const { ansaettelsesforhold: af, skadedato: _skadedato, fra, til } = args;
  // Beslutningsnote: basisstien må ikke være afhængig af at callsites altid har kørt
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

  if (!harAktivOverenskomst(af)) {
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
    const auto = resolveOverenskomstSatsBindings(af, segment.startDato);
    return {
      fra: segment.fra,
      til: segment.til,
      satser: {
        feriePct: af.feriePct,
        fritvalgPct: resolveSatsForSegment(auto.fritvalgPct, af.fritvalgPct),
        shSoPct: resolveSatsForSegment(auto.shSoPct, af.shSoPct),
        storeBededagPct: resolveStoreBededagPct(af, segment.startDato),
        pensionPct: resolveSatsForSegment(auto.pensionPct, af.pensionPct),
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
