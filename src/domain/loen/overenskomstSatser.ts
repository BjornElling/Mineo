import type { ISODateString } from '../../types/branded';
import { danishToISO, isoToDanish } from '../../types/branded';
import {
  getEffektiveSatserForDato,
  getOffentligTillaegsSatserForDato,
  getFoersteSatsDatoForPrivatOverenskomst,
  isOffentligOverenskomstId,
  resolveOverenskomstDisplay,
  resolveOverenskomstRef,
} from '../../data/overenskomstRates';
import { round2 } from '../../utils/roundingShortcuts';
import { resolveAktivOverenskomst, type OverenskomstValg } from './aktivOverenskomst';

/** Satsopslagets styrende brugerinput, fælles for årsløn og lønindkomst. */
export type OverenskomstSatsValg = OverenskomstValg & Readonly<{
  loenPaaHelligdage?: string | undefined;
}>;

export type OverenskomstSatsField = 'fritvalgPct' | 'shSoPct' | 'pensionPct';

/**
 * Hvor et af de tre overenskomstbundne tillæg kommer fra.
 *
 * - `overenskomst`: overenskomsten fastsætter satsen – også 0, når den ikke giver tillægget. Feltet er låst.
 * - `utilgaengelig`: der er valgt en privat overenskomst, men programmet har ingen satser for den på datoen
 *   (datoen ligger før overenskomstens første satsperiode). Feltet er låst og tomt, og situationen meldes
 *   gennem satsdækningen – den må ikke ligne en tom indtastning eller et tillæg på 0 %.
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

export type OverenskomstSatsBindings = Readonly<Record<OverenskomstSatsField, OverenskomstSatsBinding>>;

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
 * Satsen, KORTET og beregningsgrundlaget viser og regner med på reguleringsdatoen. Et utilgængeligt opslag
 * giver et TOMT låst felt, ikke 0: beregningen er spærret, og feltet må ikke påstå en sats, programmet ikke har.
 */
export const resolveSatsForReguleringsdato = (
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

export const resolveOverenskomstSatsBindings = (
  af: OverenskomstSatsValg,
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

export const isOverenskomstSatsFieldLocked = (
  af: OverenskomstSatsValg,
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
  af: OverenskomstValg
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
  af: OverenskomstSatsValg,
  anvendtReguleringsdato: ISODateString | undefined,
  field: OverenskomstSatsField
): boolean => resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[field].kind === 'overenskomst';

/** Samme forklaring ved låste satsfelter på årsløn og lønindkomst. */
export const resolveLockedOverenskomstSatsTooltip = (
  binding: OverenskomstSatsBinding,
  daekning: PrivatOverenskomstDaekning | null,
  reguleringsdato: ISODateString | undefined,
): string | undefined => {
  if (binding.kind === 'utilgaengelig') {
    return daekning === null ? undefined : formatOverenskomstUdenSatserTekst(daekning);
  }
  return reguleringsdato === undefined
    ? 'Fastsat af overenskomsten'
    : `Fastsat af overenskomsten på ${isoToDanish(reguleringsdato)}`;
};
