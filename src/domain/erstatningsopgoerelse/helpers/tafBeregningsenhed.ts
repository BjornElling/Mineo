import type { StandardLoenTableRow, ErstatningsopgoerelseValues, JaNej, LoenPaaHelligdage } from '../../../schemas/formSchemas';
import type { DeepReadonly } from '../../../types/deepReadonly';
import { parseISODate } from '../../../types/branded';
import { isStandardLoenTableValueEffectivelyEmptyForValidation } from '../../standardLoen/standardLoenTableValidation';
import { type DateInterval } from '../../../utils/isoDateHelpers';
import { parseAarsloenRowInterval, type AarsloenRowPeriodColumns } from '../../aarsloen/aarsloenRowInterval';

export const TAF_BEREGNES_SOM = {
  MAANEDER: 'Måneder',
  ARBEJDSDAGE: 'Arbejdsdage',
} as const;

export type TafBeregningsenhed = (typeof TAF_BEREGNES_SOM)[keyof typeof TAF_BEREGNES_SOM];

/**
 * Centrale beregningsprincipper for beregning og fraværsdage
 *
 * Domæneprincip (normativt):
 * - Der foretages to adskilte beregninger: beregningsgrundlaget (referenceperioden før skaden)
 *   og selve TAF-kravet. De opgøres altid efter samme princip: måneder eller arbejdsdage.
 * - Valget mellem måneder og arbejdsdage er beregningsteknisk og uafhængigt af lønperiode
 *   (månedsløn/dagsløn).
 *
 * Måneder:
 * - SH-dage og feriedage udgår aldrig, hverken af beregningsgrundlaget eller TAF-perioden.
 * - "Øvrigt fravær uden løn" reducerer kun beregningsgrundlaget (4,8% af en måned pr. dag),
 *   aldrig selve TAF-kravet.
 *
 * Arbejdsdage:
 * - SH-dage og feriedage udgår af både beregningsgrundlaget og TAF-perioden.
 * - Løse feriedage placeres på de første hverdage, der ikke i forvejen er SH-dage eller
 *   daterede feriedage. Der er separate indtastninger for løse feriedage i
 *   beregningsgrundlaget og TAF-perioden.
 * - "Øvrigt fravær uden løn" reducerer kun beregningsgrundlaget, aldrig selve TAF-kravet.
 *
 * Øvrige fraværsdage i TAF-perioden:
 * - Hvis sådanne dage skal udgå af TAF-kravet, håndteres det ved at brugeren udelader dagene
 *   i de angivne TAF-perioder (ingen automatisk fradrag).
 *
 * Bemærk:
 * - Faktoren er udtrykt som "måneder pr. arbejdsdag".
 * - `0.048` svarer til 4,8% (dansk decimal: 4,8%).
 */
export const TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR = 0.048;

const ALMINDELIG_LOEN_PAA_HELLIGDAGE: LoenPaaHelligdage = 'Almindelig løn';
const JA: JaNej = 'Ja';
const AMOUNT_KEYS = ['col2', 'col3', 'col4', 'col5'] as const;

/** De kolonner i en lønrække, enheden afhænger af: periodens datoer og de fire beløbskolonner. */
export type TafBeregningsenhedLoenRow = AarsloenRowPeriodColumns
  & Pick<StandardLoenTableRow, (typeof AMOUNT_KEYS)[number]>;

const rowHasIndtastetLoen = (row: TafBeregningsenhedLoenRow): boolean => {
  return AMOUNT_KEYS.some((key) => !isStandardLoenTableValueEffectivelyEmptyForValidation(row[key]));
};

const hasOverlap = (left: DateInterval, right: DateInterval): boolean => {
  return left.start <= right.end && left.end >= right.start;
};

const employmentHasOverlappendeIndtastetLoen = (
  employment: TafBeregningsenhedInput['loenindkomstAnsaettelsesforhold'][number],
  beregningsperiode: DateInterval
): boolean => {
  const rows = employment.indtaegtsoplysningerTableData ?? [];
  // Perioden prøves før beløbene: resultatet er det samme, men en række uden for beregningsperioden
  // behøver da ikke få sine beløb læst. Det betyder noget for relevansreglen, som læser felt for felt.
  for (const row of rows) {
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval || !hasOverlap(interval, beregningsperiode)) continue;
    if (rowHasIndtastetLoen(row)) return true;
  }
  return false;
};

/**
 * Afgør om tabt arbejdsfortjeneste (TAF) beregnes i `Måneder` eller `Arbejdsdage`.
 *
 * Hvorfor denne afgrænsning er central
 * - Den påvirker fremtidige beregningsprincipper (fx hvordan "løse feriedage" og andre fraværsdage prissættes).
 * - Den skal kunne anvendes bredt i domænelogikken (beregning, kontrol/audit, PDF), uden afhængighed af UI-state.
 *
 * Regler (normative, implementeres præcist som angivet)
 *
 * 1) Standard: TAF beregnes i måneder.
 * 2) EOOplysninger → "Beregnes ud fra" (har forrang):
 *    - "Angivet månedsløn" ⇒ `Måneder`
 *    - "Angivet dagsløn" ⇒ `Arbejdsdage`
 * 3) Overstyring fra lønindkomst (gælder kun når punkt 2 ikke er angivet løn):
 *    Hvis der findes blot ét ansættelsesforhold under Lønindkomst som har indtastet løn
 *    i en række, der overlapper beregningsperioden, og hvor
 *    - "Løn på helligdage" ≠ "Almindelig løn", eller
 *    - "Fuld løn under ferie" ≠ "Ja"
 *    så beregnes TAF som `Arbejdsdage`.
 *
 * Bemærkning (domæneprincip, til brug ved fremtidig implementering):
 * - Beregningsgrundlag og TAF-krav følger altid samme princip (måneder/arbejdsdage).
 * - "Øvrigt fravær uden løn" påvirker kun beregningsgrundlaget, aldrig TAF-kravet.
 * - Fraværsdage, som skal udgå af TAF-kravet, håndteres ved at brugeren udelader dagene
 *   i TAF-perioderne.
 *
 * VIGTIGT:
 * - Funktionen er ren (pure) og må kun afhænge af schema-valideret (committed) input.
 * - Ingen UI-draft state, ingen side effects.
 */
/**
 * Kun de felter, afgørelsen faktisk læser. Typen er smal med vilje: descriptorens relevansregel for «Løse
 * ferie-/feriefridage» bygger inputtet fra en `CanonicalView` og skal kunne give præcis dette – ikke et helt
 * ansættelsesforhold. Rækkerne er en `Iterable`, så reglen kan levere dem dovent og kun læse de rækker og
 * felter, afgørelsen når frem til.
 */
export type TafBeregningsenhedEmployment = DeepReadonly<
  Pick<
    ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number],
    'loenPaaHelligdage' | 'fuldLoenUnderFerie' | 'loenperiode'
  >
> & Readonly<{ indtaegtsoplysningerTableData?: Iterable<TafBeregningsenhedLoenRow> | undefined }>;

export type TafBeregningsenhedInput = Readonly<{
  // Inputtet er beregnet til brug i engines og må være DeepReadonly.
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  tafBeregningsperiodeFra?: ErstatningsopgoerelseValues['tafBeregningsperiodeFra'];
  tafBeregningsperiodeTil?: ErstatningsopgoerelseValues['tafBeregningsperiodeTil'];
  loenindkomstAnsaettelsesforhold: ReadonlyArray<TafBeregningsenhedEmployment>;
}>;

export const computeTafBeregningsenhed = (values: TafBeregningsenhedInput): TafBeregningsenhed => {
  // Angivet løn i EO-oplysninger har forrang over alle afledte lønindkomst-regler.
  if (values.beregnesUdFra === 'Angivet månedsløn') return TAF_BEREGNES_SOM.MAANEDER;
  if (values.beregnesUdFra === 'Angivet dagsløn') return TAF_BEREGNES_SOM.ARBEJDSDAGE;
  if (values.beregnesUdFra === 'Beregningsperiode') {
    const fraDate = parseISODate(values.tafBeregningsperiodeFra);
    const tilDate = parseISODate(values.tafBeregningsperiodeTil);
    if (fraDate && tilDate && fraDate <= tilDate) {
      const beregningsperiode: DateInterval = { start: fraDate, end: tilDate };
      const loenindkomstOverstyrerTilArbejdsdage = (values.loenindkomstAnsaettelsesforhold ?? []).some((af) => {
        if (af.loenPaaHelligdage === ALMINDELIG_LOEN_PAA_HELLIGDAGE && af.fuldLoenUnderFerie === JA) {
          return false;
        }
        return employmentHasOverlappendeIndtastetLoen(af, beregningsperiode);
      });
      if (loenindkomstOverstyrerTilArbejdsdage) return TAF_BEREGNES_SOM.ARBEJDSDAGE;
    }
  }

  return TAF_BEREGNES_SOM.MAANEDER;
};
