import type { ISODateString } from '../../../types/branded';
import type { Beregningsmetode } from '../../../schemas/formSchemas/enumSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { STORE_BEDEDAG_PCT, STORE_BEDEDAG_START } from '../../../data/indskudteLoentillaeg';

/** Det fælles, persisted valg som alene kan aktivere Store Bededagstillægget. */
export type StoreBededagstillaegValg = Readonly<{
  loenPaaHelligdage: string | undefined;
  beregnStoreBededagstillaeg: boolean | undefined;
}>;

/**
 * Load-migreringens værdi for en ældre fil UDEN togglen: hidtil beregnedes tillægget netop ved almindelig løn på
 * helligdage, så det er den kompatibilitetsbevarende værdi. Et NYT kort får altid `true`
 * (`createDefaultLoenindkomstAnsaettelsesforhold`, BB-281).
 */
export const resolveDefaultStoreBededagstillaeg = (loenPaaHelligdage: string | undefined): boolean =>
  loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;

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

/**
 * Hvornår der SÆDVANLIGVIS er krav på tillægget – og dermed grund til at advare, når det er fravalgt.
 *
 * Den juridiske præmis (udvikleren, 2026-10-02; se `indskudte-loentillaeg-contract.md` §2b):
 * - Store Bededag blev afskaffet som helligdag fra 1. januar 2024. Den, der får **samme løn uanset antallet af
 *   arbejdsdage** – angivet månedsløn, eller en beregningsperiode med almindelig (fuld) løn på helligdage – arbejder
 *   nu én dag mere for samme løn og kompenseres med tillægget på 0,45 %.
 * - Den, der aflønnes med en **angivet dagsløn**, får løn for de dage, der arbejdes. Store Bededag er fra 2024 en
 *   arbejdsdag i TAF-perioden (`shDageBeregning.ts`), så dagen kompenseres allerede gennem antallet af
 *   arbejdsdage, og der er **aldrig** krav på tillægget. Advarslen tier derfor ved angivet dagsløn (BB-267).
 */
export const kanDerVaereKravPaaStoreBededagstillaeg = (
  beregnesUdFra: Beregningsmetode | undefined,
  loenPaaHelligdage: string | undefined,
): boolean =>
  beregnesUdFra !== 'Angivet dagsløn' && loenPaaHelligdage === LOEN_PAA_HELLIGDAGE.ALMINDELIG;
