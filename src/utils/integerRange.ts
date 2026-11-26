import { formatAsAmount } from './formatUtils';

// Interval-beskeden for heltals- OG beløbsfelter.
//
// **Tallene formateres dansk.** Beskeden skrev før grænserne rå: «Værdi skal være mellem 1000 og
// 551000» – uden tusindseparator, i et felt, der selv viser værdien som `600.000`, og ved siden af feltets
// anden regel, som formaterer korrekt («Skadelidtes årsløn (efter ASL) skal være deleligt med 1.000.»). To tekster om samme
// størrelsesorden i to former på det samme felt. AGENTS.md kræver danske talkonventioner i tooltips.
//
// **Enheden er valgfri og hører til feltet, ikke til helperen.** «Værdi skal være mellem 1 og 10» siger
// ikke, at der er tale om ÅR; kalderen leverer enheden, fordi kun den ved, hvad tallet tæller.

export type IntegerRangeMessageOptions = Readonly<{
  /**
   * Enheden efter grænsetallet, fx `'kr.'` eller `'år'`. Udeladt = intet suffiks (uændret ordlyd for de
   * felter, hvor tallet ikke tæller noget navngivet).
   */
  unit?: string;
  /**
   * Den nedre grænse er EKSKLUSIV: `minValue` selv er ikke tilladt («skal være større end 0 kr.»).
   *
   * Med en inklusiv bounds-grænse på 0 og en separat «> 0»-regel rammer et negativt resultat begge, og
   * bounds-beskeden («Værdi skal være 0 kr. eller højere») vinder efter §1.8's prioritet og påstår, at 0 er
   * tilladt. Med grænsen erklæret som eksklusiv udledes ÉN besked, der er sand for både 0 og negativt.
   */
  minExclusive?: boolean;
  /** Sætningens subjekt, fx `'Beløbet'` eller `'Månedslønnen'`. Udeladt = `'Værdi'`. */
  subject?: string;
}>;

/** Grænsetallet i dansk form, med feltets enhed når den findes. */
const formatBound = (value: number, unit: string | undefined): string => {
  const formatted = formatAsAmount(value, 0);
  return unit === undefined ? formatted : `${formatted} ${unit}`;
};

export const getIntegerRangeErrorMessage = (
  parsed: number,
  minValue: number | undefined,
  maxValue: number | undefined,
  options: IntegerRangeMessageOptions = {}
): string => {
  const { unit, minExclusive = false, subject = 'Værdi' } = options;
  const min = minValue === undefined ? undefined : formatBound(minValue, unit);
  const max = maxValue === undefined ? undefined : formatBound(maxValue, unit);

  if (minExclusive && typeof minValue === 'number') {
    // En eksklusiv nedre grænse har sin egen ordlyd i hele intervallet: «mellem 0 og 100» ville påstå, at
    // 0 er tilladt. Begge brud – under/lig minimum og over maksimum – får derfor samme sande sætning.
    const belowOrAtMin = parsed <= minValue;
    const aboveMax = typeof maxValue === 'number' && parsed > maxValue;
    if (!belowOrAtMin && !aboveMax) return '';
    return typeof maxValue === 'number'
      ? `${subject} skal være større end ${min} og højst ${max}`
      : `${subject} skal være større end ${min}`;
  }

  if (typeof minValue === 'number' && parsed < minValue) {
    if (typeof maxValue === 'number') {
      // Ligheds-tilfælde (min === max): vis den ene tilladte værdi i stedet for "mellem X og X".
      // Ensartet for både formularfelt og tabelcelle (A2).
      if (minValue === maxValue) return `${subject} skal være ${min}`;
      return `${subject} skal være mellem ${min} og ${max}`;
    }
    return `${subject} skal være ${min} eller højere`;
  }

  if (typeof maxValue === 'number' && parsed > maxValue) {
    if (typeof minValue === 'number') {
      if (minValue === maxValue) return `${subject} skal være ${max}`;
      return `${subject} skal være mellem ${min} og ${max}`;
    }
    return `${subject} skal være ${max} eller lavere`;
  }

  return '';
};
