import type { ISODateString } from '../../types/branded';
import {
  formatAslAarsloensmaksimumMissing,
  resolveAslAarsloensmaksimumForAar,
} from '../satser/aslAarsloensmaksimum';
import { formatAsAmount } from '../../utils/formatUtils';
import { isoYear } from '../../utils/isoDateHelpers';
import { resolveStamdataDatoReference, type StamdataValues } from '../policies/stamdataCalculations';
import { SKADELIDTES_AARSLOEN_ASL_LABEL } from './aarsloenLabels';

export const validateAslAarsloenDivisibleBy1000 = (
  aarsloen: number | undefined
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (aarsloen % 1000 !== 0) return `${SKADELIDTES_AARSLOEN_ASL_LABEL} skal være deleligt med 1.000.`;
  return undefined;
};

/**
 * Det kanoniske ASL-årslønsloft for en skade. Feltets bounds-visning og den
 * efterfølgende domæneregel skal bruge samme skadesår; hvis de hver udleder
 * et år fra hver sin dato, kan en værdi, som tooltippen tillader, straks blive
 * afvist af den næste valideringskanal.
 */
export const resolveAslAarsloensmaksimumForSkadedato = (
  skadedatoIso: ISODateString | undefined
): number | undefined =>
  skadedatoIso === undefined
    ? undefined
    : resolveAslAarsloensmaksimumForAar(isoYear(skadedatoIso));

/**
 * ASL-årslønnens loft for skadesåret.
 *
 * `skadestype` styrer, om beskeden siger «skadesåret» eller «anmeldelsesåret» (BB-121) – samme navneregel
 * som resten af programmet. Den er valgfri, fordi flere kaldere kun har datoen; udelades den, bruges
 * «skadesår», som er reglens udgangspunkt.
 *
 * Beskeden er nu den, brugeren FAKTISK ser (BB-125). Den var før uopnåelig, fordi feltet også havde et
 * generisk bounds-loft med samme grænse, og bounds-validatoren kørte først og vandt med «Værdi skal være
 * mellem 1000 og 551000». Det dublerede loft er fjernet fra descriptoren; denne besked er den ene, der
 * navngiver, hvor grænsen kommer fra.
 */
export const validateAslAarsloenBySkadesaarMax = (
  aarsloen: number | undefined,
  skadedatoIso: ISODateString | undefined,
  skadestype?: StamdataValues['skadestype']
): string | undefined => {
  if (aarsloen === undefined || !Number.isFinite(aarsloen)) return undefined;
  if (skadedatoIso === undefined) return undefined;

  const skadesaar = isoYear(skadedatoIso);
  const maxAarsloen = resolveAslAarsloensmaksimumForSkadedato(skadedatoIso);
  if (maxAarsloen === undefined) {
    // Fail-closed: en manglende maks-sats for skadesåret må ikke stiltiende acceptere årslønnen.
    // Det rammer fx en skade i et år uden offentliggjort sats (før 2005 eller et fremtidigt år).
    // Kanonisk ordlyd via gateway'en – samme besked som de øvrige faner.
    return formatAslAarsloensmaksimumMissing(skadesaar);
  }
  if (aarsloen <= maxAarsloen) return undefined;

  const aarLabel = resolveStamdataDatoReference(skadestype).aar;
  return `${SKADELIDTES_AARSLOEN_ASL_LABEL} kan ikke overstige maks årslønnen i ${aarLabel}et (${formatAsAmount(maxAarsloen, 0)} kr.)`;
};
