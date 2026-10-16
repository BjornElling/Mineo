import type { ISODateString } from '../../../types/branded';
import {
  getGrundloenAngivetPerForOverenskomst,
  type OverenskomstPeriodeSats,
} from '../../../data/overenskomstRates';
import { STORE_BEDEDAG_PCT, STORE_BEDEDAG_START } from '../../../data/indskudteLoentillaeg';
import { round2 } from '../../../utils/roundingShortcuts';
import type { OffentligLoenType } from '../../../data/offentligLoenTypes';
import { convertAnciennitetSats, resolvePctPointFromSatsOrInput } from '../helpers/eoSharedUtils';
import type { FormulaComponents } from './reguleringFormulaUtils';

// =============================================================================
// Anciennitetstillæg i reguleringsforløb – fælles opløsning for motorens to overenskomst-grene.
// Tillæggets kroneværdi og aktiveringsdato evalueres hos producenten og indgår derefter i
// segmentets reguleringsbevis. Præsentationen formatterer dette uden nye satsvalg.
// =============================================================================

/**
 * Anciennitetstillæg der er aktivt fra en given dato, delt af begge overenskomst-grene.
 * Datoen må efter den nuværende domæneregel kun ligge efter anvendt reguleringsdato, så
 * tillægget er aldrig en del af referenceniveauet (indeks 100). `activeFromIso` bruges til
 * segment-splitting og per-segment-gate; ligger datoen før den viste periode, clampes den op til
 * periodens første dag.
 */
export type AnciennitetForIndex = Readonly<{
  activeFromIso: ISODateString;
  supplementValue: number;
}>;

export type AnciennitetForIndexInput = Readonly<{
  harAnciennitetstillaeg: boolean | undefined;
  anciennitetstillaegDatoIso: ISODateString | undefined;
  satsValue: number | undefined;
  satsAngivesPer: 'Time' | 'Måned' | undefined;
  overenskomstId: string | undefined;
  /** «Ansættelse» ved offentlig overenskomst; `undefined` ved privat, hvor overenskomstens enhed gælder. */
  offentligLoenType: OffentligLoenType | undefined;
  anvendtReguleringsdatoIso: ISODateString | undefined;
  // Periodens grænser fra motorens tafRanges.
  periodeStartIso: ISODateString;
  periodeEndIso: ISODateString;
}>;

/**
 * Udleder anciennitetstillæggets kroneværdi (i lønpakkens enhed, jf. `getGrundloenAngivetPerForOverenskomst`)
 * + aktiveringsdato, eller `null` hvis der intet aktivt tillæg er. `anciennitetstillaegSatsAngivesPer` er
 * schema-defaultet til 'Måned', så `?? 'Måned'` er blot defensivt (aldrig nået for schema-gyldigt input).
 */
export const resolveAnciennitetForIndex = (
  input: AnciennitetForIndexInput
): AnciennitetForIndex | null => {
  if (!input.harAnciennitetstillaeg) return null;
  const anciennitetDato = input.anciennitetstillaegDatoIso;
  const satsValue = input.satsValue;
  if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
    return null;
  }
  if (input.anvendtReguleringsdatoIso && anciennitetDato <= input.anvendtReguleringsdatoIso) return null;
  if (anciennitetDato > input.periodeEndIso) return null;
  if (!input.overenskomstId) return null;
  const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(input.overenskomstId, input.offentligLoenType);
  if (!grundloenAngivetPer) return null;
  const supplementValue = convertAnciennitetSats(satsValue, input.satsAngivesPer ?? 'Måned', grundloenAngivetPer);
  const roundedSupplement = round2(supplementValue);
  if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
  return {
    activeFromIso: anciennitetDato < input.periodeStartIso ? input.periodeStartIso : anciennitetDato,
    supplementValue: roundedSupplement,
  };
};

/**
 * Bygger den offentlige overenskomsts formelkomponenter til producentens reference- og periodepakke.
 * `grundloen` er allerede summeret af kaldstedet: løn, ekstra grundløn og eventuelt anciennitetstillæg.
 * Satsvalg og dækningskontrol ligger i `overenskomstOffentligSegmenter`; alle visninger formatterer
 * de evaluerede komponenter fra reguleringsbeviset uden selvstændig pakke- eller indeksberegning.
 */
export const buildOffentligOverenskomstFormulaComponents = (args: Readonly<{
  grundloen: number;
  feriePct: number;
  tillaegsSatser: OverenskomstPeriodeSats | undefined;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
  applyStoreBededagstillaeg: boolean;
  dateIso: ISODateString;
}>): FormulaComponents => ({
  baseValue: args.grundloen,
  feriePct: args.feriePct,
  fritvalgPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.fritvalg, args.fritvalgPctInput),
  shSoPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.shSoSats, args.shSoPctInput),
  pensionPct: resolvePctPointFromSatsOrInput(args.tillaegsSatser?.agPension, args.pensionPctInput),
  storeBededagPct: args.applyStoreBededagstillaeg && args.dateIso >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0,
});

export const buildPrivateOverenskomstFormulaComponents = (args: Readonly<{
  sats: OverenskomstPeriodeSats;
  feriePct: number;
  shSoPctInput: number | undefined;
  fritvalgPctInput: number | undefined;
  pensionPctInput: number | undefined;
  dateIso: ISODateString;
  baseValueSupplement?: number;
  applyStoreBededagstillaeg: boolean;
}>): FormulaComponents => ({
  baseValue: (args.sats.grundloen ?? 0) + (args.baseValueSupplement ?? 0),
  feriePct: args.feriePct,
  fritvalgPct: resolvePctPointFromSatsOrInput(args.sats.fritvalg, args.fritvalgPctInput),
  shSoPct: resolvePctPointFromSatsOrInput(args.sats.shSoSats, args.shSoPctInput),
  pensionPct: resolvePctPointFromSatsOrInput(args.sats.agPension, args.pensionPctInput),
  storeBededagPct: args.applyStoreBededagstillaeg && args.dateIso >= STORE_BEDEDAG_START
    ? STORE_BEDEDAG_PCT
    : 0,
});
