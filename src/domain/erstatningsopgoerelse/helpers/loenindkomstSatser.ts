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
  getFoersteSatsDatoForPrivatOverenskomst,
  isOffentligOverenskomstId,
  resolveOverenskomstDisplay,
  resolveOverenskomstRef,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { resolveStoreBededagstillaegPct } from './storeBededagstillaeg';
import { parsePercentToDecimal } from '../../../utils/numberParsing';
import type { StandardLoenRateSegment, StandardLoenSatserInput } from '../../aarsloen/standardLoenRowCalculations';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import { findLatestByDateKeyInSortedList } from '../engines/reguleringSeriesLookup';
import { round2 } from '../../../utils/roundingShortcuts';
import { generateLoenudviklingRowId, initialLoenudviklingManuelRow } from './eoRowInitialValues';
import { harAktivOverenskomst, resolveAktivOverenskomst } from './aktivOverenskomst';

export type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

/**
 * Hvor et af de tre overenskomstbundne tillæg kommer fra.
 *
 * - `overenskomst`: overenskomsten fastsætter satsen – også 0, når den ikke giver tillægget. Feltet er låst.
 * - `utilgaengelig`: der er valgt en privat overenskomst, men programmet har ingen satser for den på datoen
 *   (datoen ligger før overenskomstens første satsperiode). Feltet er låst og tomt, og situationen meldes
 *   (`resolveOverenskomstSatsDaekning`) – den må ikke ligne en tom indtastning eller et tillæg på 0 %.
 * - `bruger`: brugerens eget felt – uden aktiv overenskomst, eller ved en offentlig overenskomst uden sats.
 *
 * Før var der kun «låst med tal» og «ulåst». Manglede satserne på datoen, faldt programmet tilbage til de
 * ulåste felter, som brugeren aldrig havde udfyldt, fordi de stod låst – og tillæggene blev tavst 0 %
 * (BB-275). En privat overenskomst dikterer, hvilke tillæg der gives, så dens felter låses aldrig op.
 */
export type OverenskomstSatsBinding =
  | Readonly<{ kind: 'overenskomst'; value: number }>
  | Readonly<{ kind: 'utilgaengelig' }>
  | Readonly<{ kind: 'bruger' }>;

type OverenskomstSatsBindings = Readonly<Record<OverenskomstSatsField, OverenskomstSatsBinding>>;

type AutoSatsFields = Pick<
  LoenindkomstAnsaettelsesforhold,
  'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct'
>;

const BRUGER_SATS_BINDINGS: OverenskomstSatsBindings = {
  fritvalgPct: { kind: 'bruger' },
  shSoPct: { kind: 'bruger' },
  pensionPct: { kind: 'bruger' },
};

const UTILGAENGELIGE_SATS_BINDINGS: OverenskomstSatsBindings = {
  fritvalgPct: { kind: 'utilgaengelig' },
  shSoPct: { kind: 'utilgaengelig' },
  pensionPct: { kind: 'utilgaengelig' },
};

/** Er feltet låst af overenskomsten – også når programmet ingen sats har (`utilgaengelig`)? */
const isBindingLocked = (binding: OverenskomstSatsBinding): boolean => binding.kind !== 'bruger';

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

/**
 * Satsen, KORTET og beregningsgrundlaget viser og regner med på reguleringsdatoen. Et utilgængeligt opslag
 * giver et TOMT låst felt, ikke 0: beregningen er spærret, og feltet må ikke påstå en sats, programmet ikke har.
 */
const resolveSatsForReguleringsdato = (
  binding: OverenskomstSatsBinding,
  brugerValue: number | undefined
): number | undefined => {
  switch (binding.kind) {
    case 'overenskomst': return binding.value;
    case 'utilgaengelig': return undefined;
    case 'bruger': return brugerValue;
  }
};

const offentligBindingFromDecimal = (value: number | null): OverenskomstSatsBinding =>
  value === null ? { kind: 'bruger' } : { kind: 'overenskomst', value: round2(value * 100) };

// `assertPrivatOverenskomstFastsaetterTillaeg` garanterer et tal for en privat overenskomst; null er her
// derfor en brudt datainvariant og må ikke falde stille tilbage til et frit felt.
const privatBindingFromDecimal = (value: number | null, overenskomstId: string): OverenskomstSatsBinding => {
  if (value === null) {
    throw new Error(`Privat overenskomst "${overenskomstId}" mangler en tillægssats – datainvarianten er brudt`);
  }
  return { kind: 'overenskomst', value: round2(value * 100) };
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

const resolveOverenskomstSatsBindingsForAnvendtReguleringsdato = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined
): OverenskomstSatsBindings => {
  // Aktiv-prædikatet ejes af `resolveAktivOverenskomst` (§ét sandt sted) – ikke stavet i hånden her.
  const aktiv = resolveAktivOverenskomst(af);
  if (!aktiv.aktiv) return BRUGER_SATS_BINDINGS;
  const overenskomstId = aktiv.overenskomstId;
  const applyShRegel = af.loenPaaHelligdage === 'Almindelig løn';
  const dato = anvendtReguleringsdato ? isoToDanish(anvendtReguleringsdato) : undefined;

  if (isOffentligOverenskomstId(overenskomstId)) {
    // Offentlige overenskomster er undtagelsen: et tillæg uden sats (KL/RLTN helt, Læreroverenskomstens SH/SO)
    // angiver brugeren selv.
    const satser = dato ? getOffentligTillaegsSatserForDato(overenskomstId, dato, applyShRegel) : undefined;
    if (!satser) return BRUGER_SATS_BINDINGS;
    return {
      fritvalgPct: offentligBindingFromDecimal(satser.fritvalg),
      shSoPct: offentligBindingFromDecimal(satser.shSoSats),
      pensionPct: offentligBindingFromDecimal(satser.agPension),
    };
  }

  // En privat overenskomst låser altid sine tillæg. Uden dato kan intet slås op endnu: felterne står låste og
  // tomme, og den manglende dato meldes der, hvor den indtastes.
  if (!dato) return UTILGAENGELIGE_SATS_BINDINGS;
  const ref = resolveOverenskomstRef(overenskomstId);
  const satser = ref
    ? getEffektiveSatserForDato({ overenskomstId: ref.baseId, dato, applyAlmindeligLoenPaaShDageRegel: applyShRegel })
    : undefined;
  if (!satser) return UTILGAENGELIGE_SATS_BINDINGS;
  return {
    fritvalgPct: privatBindingFromDecimal(satser.fritvalg, overenskomstId),
    shSoPct: privatBindingFromDecimal(satser.shSoSats, overenskomstId),
    pensionPct: privatBindingFromDecimal(satser.agPension, overenskomstId),
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
): boolean => isBindingLocked(resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[field]);

/**
 * Den aktive PRIVATE overenskomsts satsdækning: fra hvilken dato programmet har dens satser. `null`, når kortet
 * ikke har en aktiv privat overenskomst (offentlige overenskomster melder ikke dækning – deres tillæg uden sats
 * angiver brugeren selv). `foersteSatsDato` er `undefined` for et overenskomst-id, programmet ikke kender.
 */
export type PrivatOverenskomstDaekning = Readonly<{
  overenskomstId: string;
  foersteSatsDato: ISODateString | undefined;
}>;

export const resolvePrivatOverenskomstDaekning = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId'>
): PrivatOverenskomstDaekning | null => {
  const aktiv = resolveAktivOverenskomst(af);
  if (!aktiv.aktiv || isOffentligOverenskomstId(aktiv.overenskomstId)) return null;
  const foerste = getFoersteSatsDatoForPrivatOverenskomst(aktiv.overenskomstId);
  return { overenskomstId: aktiv.overenskomstId, foersteSatsDato: foerste ? danishToISO(foerste) : undefined };
};

/** Har programmet ingen satser for overenskomsten på datoen? */
export const erDatoUdenOverenskomstSatser = (daekning: PrivatOverenskomstDaekning, dato: ISODateString): boolean =>
  daekning.foersteSatsDato === undefined || dato < daekning.foersteSatsDato;

/**
 * «Bygge-/anlægsoverenskomsten (3F / Dansk Industri) har ingen satser før 01-03-2011» – fælles kerne for den
 * røde fejl ved en reguleringsdato uden satser og den gule advarsel ved lønrækker før dækningen (BB-275).
 */
export const formatOverenskomstUdenSatserTekst = (daekning: PrivatOverenskomstDaekning): string => {
  const navn = resolveOverenskomstDisplay(daekning.overenskomstId);
  const foerste = daekning.foersteSatsDato ? isoToDanish(daekning.foersteSatsDato) : undefined;
  return foerste ? `${navn} har ingen satser før ${foerste}` : `${navn} har ingen satser`;
};

/** Den røde, blokerende besked, når datoen satserne slås op på, ligger før overenskomstens dækning. */
export const formatReguleringsdatoUdenOverenskomstSatserBesked = (daekning: PrivatOverenskomstDaekning): string =>
  `${formatOverenskomstUdenSatserTekst(daekning)} – vælg en senere reguleringsdato`;

/** Den gule advarsel, når lønrækker ligger før overenskomstens første satsperiode. */
export const formatLoenraekkerUdenOverenskomstSatserBesked = (daekning: PrivatOverenskomstDaekning): string =>
  `${formatOverenskomstUdenSatserTekst(daekning)} – lønrækker før denne dato er regnet uden overenskomstens tillæg`;

/**
 * Er feltets værdi AFLEDT af overenskomsten – og derfor ikke brugerinput, der gemmes? Kun når overenskomsten
 * faktisk fastsætter satsen. Ved et utilgængeligt opslag bevares et tidligere indtastet slot i filen: det er
 * brugerens værdi fra før, og den bliver synlig igen, hvis «Overenskomst» slås fra.
 */
export const isOverenskomstSatsFieldDerived = (
  af: Pick<LoenindkomstAnsaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  anvendtReguleringsdato: ISODateString | undefined,
  field: OverenskomstSatsField
): boolean => resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[field].kind === 'overenskomst';

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
    const auto = resolveOverenskomstSatsBindingsForAnvendtReguleringsdato(af, segment.startDato);
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
