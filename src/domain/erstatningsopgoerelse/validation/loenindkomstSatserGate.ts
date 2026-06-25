import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { isWithinTolerance } from '../../../utils/numberComparison';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../config/indskudteLoentillaeg';
import { resolveOverenskomstSatsBindings } from '../helpers/loenindkomstSatser';

/**
 * Satser-blokerings-gate for et lønindkomst-ansættelsesforhold: returnerer navnet på det første
 * sats-felt, der afviger fra den forventede (overenskomst-/lov-bundne) sats per den anvendte
 * reguleringsdato — eller null. Driver `loenindkomst.<af>.satserSkadestidspunkt`-rækken i den
 * autoritative række-evaluerings-motor (`domain/eoRowEvaluation/`, jf. B9), hvis `error`-rækker
 * gater produktions-PDF-download — så blokeringen er ÉN sandhedskilde.
 *
 * Genbruges af motor-helperen `eoRowIndkomstModel.ts` (adfærdsbevarende udskillelse).
 *
 * NB: Dette overlapper delvist med `loenindkomstSatsValidation.validateAllSatserForAnsaettelsesforhold`
 * (A1) — sidstnævnte driver felt-fejl i Loenindkomst-VM'en og dækker IKKE Store Bededagstillæg.
 * De to satser-valideringer bør på sigt konvergere; det er en separat, adfærds-følsom opgave.
 */

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

const hasStoreBededagSatserAfvigelse = (
  loenPaaHelligdage: string,
  inputValue: number | undefined,
  anvendtReguleringsdato: ISODateString | undefined
): boolean => {
  if (!anvendtReguleringsdato) return false;
  const isFrom2024 = anvendtReguleringsdato >= STORE_BEDEDAG_START;

  let expectedPct: number;
  if (loenPaaHelligdage === 'Almindelig løn' && isFrom2024) {
    expectedPct = STORE_BEDEDAG_PCT;
  } else {
    expectedPct = 0;
  }

  const actualValue = inputValue ?? 0;
  // 0,01 procentpoint matcher valideringstolerancen for afrundede procentsatser.
  return !isWithinTolerance(actualValue, expectedPct, 0.01);
};

const hasFeriePctAfvigelse = (inputValue: number | undefined): boolean => {
  if (inputValue === undefined) return false;
  if (inputValue >= 12) return false;
  return true;
};

const hasOverenskomstSatsAfvigelse = (
  af: Pick<Ansaettelsesforhold, 'harOverenskomst' | 'overenskomstId' | 'loenPaaHelligdage'>,
  fieldName: 'fritvalgPct' | 'shSoPct' | 'pensionPct',
  inputValue: number | undefined,
  anvendtReguleringsdato: ISODateString | undefined
): boolean => {
  const overenskomstId = af.overenskomstId?.trim();
  if (!overenskomstId) return false;
  const expectedBinding = resolveOverenskomstSatsBindings(af, anvendtReguleringsdato)[fieldName];
  if (!expectedBinding.locked || expectedBinding.value === undefined) return false;

  const expectedPct = expectedBinding.value;
  const actualValue = inputValue ?? 0;
  // 0,01 procentpoint matcher valideringstolerancen for afrundede procentsatser.
  return !isWithinTolerance(actualValue, expectedPct, 0.01);
};

export const resolveSatserErrorField = (
  af: Ansaettelsesforhold,
  anvendtReguleringsdato: ISODateString | undefined
): string | null => {
  if (hasFeriePctAfvigelse(af.feriePct)) {
    return 'Feriegodtgørelse/-tillæg';
  }
  if (hasOverenskomstSatsAfvigelse(af, 'fritvalgPct', af.fritvalgPct, anvendtReguleringsdato)) {
    return 'Fritvalg';
  }
  if (hasOverenskomstSatsAfvigelse(af, 'shSoPct', af.shSoPct, anvendtReguleringsdato)) {
    return 'SH/SO-sats';
  }
  if (hasStoreBededagSatserAfvigelse(af.loenPaaHelligdage, af.storeBededagPct, anvendtReguleringsdato)) {
    return 'Store Bededagstillæg';
  }
  if (hasOverenskomstSatsAfvigelse(af, 'pensionPct', af.pensionPct, anvendtReguleringsdato)) {
    return 'Arbejdsgivers pensionsbidrag';
  }
  return null;
};
