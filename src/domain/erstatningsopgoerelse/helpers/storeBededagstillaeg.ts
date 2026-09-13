import type { ISODateString } from '../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { STORE_BEDEDAG_PCT, STORE_BEDEDAG_START } from '../../../data/indskudteLoentillaeg';

/** Det fælles, persisted valg som alene kan aktivere Store Bededagstillægget. */
export type StoreBededagstillaegValg = Readonly<{
  loenPaaHelligdage: string | undefined;
  beregnStoreBededagstillaeg: boolean | undefined;
}>;

/**
 * "Løn på helligdage" er en forudsætning for at vise valget, men er ikke længere en beregningsregel.
 * Den særskilte toggle er nødvendig, så hverken skjult input eller en gammel automatisk antagelse kan
 * føre tillægget ind i beregninger, kontrol eller dokumenter.
 */
export const harValgtStoreBededagstillaeg = (valg: StoreBededagstillaegValg): boolean =>
  valg.loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG && valg.beregnStoreBededagstillaeg === true;

/** Den datoafhængige sats, når brugeren udtrykkeligt har tilvalgt tillægget. */
export const resolveStoreBededagstillaegPct = (
  iso: ISODateString | undefined,
  valg: StoreBededagstillaegValg
): number => harValgtStoreBededagstillaeg(valg) && iso !== undefined && iso >= STORE_BEDEDAG_START
  ? STORE_BEDEDAG_PCT
  : 0;

/** Om periodiseringen skal indsætte 1. januar 2024 som særskilt Store Bededag-grænse. */
export const harStoreBededagstillaegIInterval = (
  fra: ISODateString,
  til: ISODateString,
  valg: StoreBededagstillaegValg
): boolean => harValgtStoreBededagstillaeg(valg) && til >= STORE_BEDEDAG_START && fra <= til;
