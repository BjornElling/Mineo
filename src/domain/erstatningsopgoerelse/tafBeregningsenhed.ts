import type { AarsloenTableRow, ErstatningsopgoerelseValues, JaNej, LoenPaaHelligdage, Loenperiode } from '../../schemas/formSchemas';
import type { DeepReadonly } from '../../types/deepReadonly';
import { parseISODate } from '../../types/branded';
import { createDate, parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';

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
const AMOUNT_KEYS: ReadonlyArray<keyof AarsloenTableRow> = ['col2', 'col3', 'col4', 'col5'];

type DateInterval = Readonly<{ start: Date; end: Date }>;

const toUtcDay = (date: Date): Date => {
  return createDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const parseAarsloenRowInterval = (row: AarsloenTableRow, loenperiode: Loenperiode): DateInterval | null => {
  if (loenperiode === 'maaned') {
    const monthRaw = row.col0_maaned?.trim() ?? '';
    const yearRaw = row.col1_maaned?.trim() ?? '';
    if (monthRaw === '' || yearRaw === '') return null;

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    const start = createDate(year, month - 1, 1);
    const end = createDate(year, month, 0);
    return { start, end };
  }

  if (loenperiode === 'uge') {
    const fraUge = row.col0_uge?.trim() ?? '';
    const tilUge = row.col1_uge?.trim() ?? '';
    if (fraUge === '' || tilUge === '') return null;

    const fra = parseWeekString(fraUge);
    const til = parseWeekString(tilUge);
    if (!fra || !til) return null;
    if (fra.start > til.end) return null;
    return { start: toUtcDay(fra.start), end: toUtcDay(til.end) };
  }

  const fraDato = row.col0_dag?.trim() ?? '';
  const tilDato = row.col1_dag?.trim() ?? '';
  if (fraDato === '' || tilDato === '') return null;

  const fra = parseDanishDate(fraDato);
  const til = parseDanishDate(tilDato);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: toUtcDay(fra), end: toUtcDay(til) };
};

const rowHasIndtastetLoen = (row: AarsloenTableRow): boolean => {
  return AMOUNT_KEYS.some((key) => !isAarsloenTableValueEffectivelyEmptyForValidation(row[key]));
};

const hasOverlap = (left: DateInterval, right: DateInterval): boolean => {
  return left.start <= right.end && left.end >= right.start;
};

const employmentHasOverlappendeIndtastetLoen = (
  employment: TafBeregningsenhedInput['loenindkomstAnsaettelsesforhold'][number],
  beregningsperiode: DateInterval
): boolean => {
  const rows = employment.indtaegtsoplysningerTableData ?? [];
  for (const row of rows) {
    if (!rowHasIndtastetLoen(row)) continue;
    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;
    if (hasOverlap(interval, beregningsperiode)) return true;
  }
  return false;
};

/**
 * Afgør om tabt arbejdsfortjeneste (TAF) beregnes i `Måneder` eller `Arbejdsdage`.
 *
 * Hvorfor denne afgrænsning er central
 * - Den påvirker fremtidige beregningsprincipper (fx hvordan "løse feriedage" og andre fraværsdage prissættes).
 * - Den skal kunne anvendes bredt i domænelogikken (beregning, debug/audit, PDF), uden afhængighed af UI-state.
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
export type TafBeregningsenhedInput = Readonly<{
  // Input is designed for engine usage and may be DeepReadonly.
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  periodeTilBeregningFra?: ErstatningsopgoerelseValues['periodeTilBeregningFra'];
  periodeTilBeregningTil?: ErstatningsopgoerelseValues['periodeTilBeregningTil'];
  loenindkomstAnsaettelsesforhold: ReadonlyArray<DeepReadonly<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]>>;
}>;

export const computeTafBeregningsenhed = (values: TafBeregningsenhedInput): TafBeregningsenhed => {
  // Angivet løn i EO-oplysninger har forrang over alle afledte lønindkomst-regler.
  if (values.beregnesUdFra === 'Angivet månedsløn') return TAF_BEREGNES_SOM.MAANEDER;
  if (values.beregnesUdFra === 'Angivet dagsløn') return TAF_BEREGNES_SOM.ARBEJDSDAGE;
  if (values.beregnesUdFra === 'Beregningsperiode') {
    const fraDate = parseISODate(values.periodeTilBeregningFra);
    const tilDate = parseISODate(values.periodeTilBeregningTil);
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
