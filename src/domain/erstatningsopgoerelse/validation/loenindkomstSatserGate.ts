import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';
import { isWithinTolerance } from '../../../utils/numberComparison';
import { STORE_BEDEDAG_START, STORE_BEDEDAG_PCT } from '../../../config/indskudteLoentillaeg';
import { resolveOverenskomstSatsBindings } from '../helpers/loenindkomstSatser';
import { hasIndtastetLoenoplysninger } from '../helpers/loenoplysningerInput';

/**
 * Satser-blokerings-gate for et lønindkomst-ansættelsesforhold: returnerer det første sats-felt, der
 * enten mangler en påkrævet værdi eller afviger fra den forventede (overenskomst-/lov-bundne) sats per
 * den anvendte reguleringsdato — eller null. Driver `loenindkomst.<af>.satserSkadestidspunkt`-rækken i
 * den autoritative række-evaluerings-motor (`domain/eoRowEvaluation/`, jf. B9), hvis `error`-rækker
 * gater produktions-PDF-download — så blokeringen er ÉN sandhedskilde og altid har en synlig fejlrække.
 *
 * Genbruges af motor-helperen `eoRowIndkomstModel.ts` (adfærdsbevarende udskillelse).
 *
 * NB: Dette overlapper delvist med `loenindkomstSatsValidation.validateAllSatserForAnsaettelsesforhold`
 * (A1) — sidstnævnte driver felt-fejl i Loenindkomst-VM'en og dækker IKKE Store Bededagstillæg.
 * De to satser-valideringer bør på sigt konvergere; det er en separat, adfærds-følsom opgave.
 *
 * Feriegodtgørelses-kravet (`isFeriePctRequiredForBlocking`) deles nu ORDRET med
 * `erstatningsopgoerelseValidator`, så validatorens blokerende invariant og denne rækkes fejl aldrig
 * kan drifte fra hinanden (ellers ville download kunne blokeres uden en besked i boksen).
 */

type Ansaettelsesforhold = ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];

/**
 * Ét sandt sted for "kræver dette ansættelsesforhold en udfyldt feriegodtgørelses-/tillægs-procent
 * for at den autoritative beregning må køre?".
 *
 * Betingelsen deles ORDRET med `erstatningsopgoerelseValidator` (som konverterer den manglende sats
 * til en blokerende snapshot-invariant → blokerer download) OG med række-evaluerings-motoren
 * (`resolveSatserErrorField` → `loenindkomst.<af>.satserSkadestidspunkt`-rækken → "Fejl og advarsler"-
 * boksen). Hvis de to drev betingelsen hver for sig, kunne de drifte fra hinanden, så download blev
 * blokeret UDEN en synlig fejl i boksen. Denne fælles kilde forhindrer netop det.
 *
 * Beløb-tilstand bruger ikke de skjulte top-satsfelter; ved manuel regulering angives basis-satserne
 * i første tabelrække, og ved øvrige reguleringsformer må de skjulte felter ikke blokere.
 */
export const isFeriePctRequiredForBlocking = (
  af: Pick<
    Ansaettelsesforhold,
    'tillaegAngivesSom' | 'loenudviklingBeregningsgrundlag' | 'indtaegtsoplysningerTableData'
  >,
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra']
): boolean => {
  const grundlag = af.loenudviklingBeregningsgrundlag;
  const grundlagKraeverFeriePct = grundlag === 'Overenskomst' || grundlag === 'Manuelt angivet';
  return (
    af.tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB
    && beregnesUdFra === 'Beregningsperiode'
    && grundlagKraeverFeriePct
    && hasIndtastetLoenoplysninger(af.indtaegtsoplysningerTableData ?? [])
  );
};

/**
 * En blokerende sats-fejl for et ansættelsesforhold: hvilket sats-felt der fejler + den selvstændige
 * besked, der vises i "Fejl og advarsler"-boksen. `kind` skelner "ikke udfyldt" (manglende
 * påkrævet værdi) fra "afvigelse" (forkert indtastet værdi), så beskeden ikke fejlagtigt påstår, at
 * en tom værdi er "forkert indtastet".
 */
export type SatserError = Readonly<{
  field: string;
  message: string;
  kind: 'missing' | 'deviation';
}>;

const deviation = (field: string): SatserError => ({
  field,
  message: `Forkert værdi indtastet i ${field}`,
  kind: 'deviation',
});

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
  anvendtReguleringsdato: ISODateString | undefined,
  feriePctRequired: boolean
): SatserError | null => {
  if (af.tillaegAngivesSom === TILLAEG_ANGIVES_SOM.BELOEB) return null;
  // Manglende påkrævet feriegodtgørelse blokerer download (via validator-invarianten) og SKAL derfor
  // også optræde som en synlig fejlrække — med en "ikke udfyldt"-besked, ikke "forkert indtastet".
  if (feriePctRequired && !Number.isFinite(af.feriePct)) {
    return {
      field: 'Feriegodtgørelse/-tillæg',
      message: 'Feriegodtgørelse/-tillæg er ikke udfyldt',
      kind: 'missing',
    };
  }
  if (hasFeriePctAfvigelse(af.feriePct)) {
    return deviation('Feriegodtgørelse/-tillæg');
  }
  if (hasOverenskomstSatsAfvigelse(af, 'fritvalgPct', af.fritvalgPct, anvendtReguleringsdato)) {
    return deviation('Fritvalg');
  }
  if (hasOverenskomstSatsAfvigelse(af, 'shSoPct', af.shSoPct, anvendtReguleringsdato)) {
    return deviation('SH/SO-sats');
  }
  if (hasStoreBededagSatserAfvigelse(af.loenPaaHelligdage, af.storeBededagPct, anvendtReguleringsdato)) {
    return deviation('Store Bededagstillæg');
  }
  if (hasOverenskomstSatsAfvigelse(af, 'pensionPct', af.pensionPct, anvendtReguleringsdato)) {
    return deviation('Arbejdsgivers pensionsbidrag');
  }
  return null;
};
