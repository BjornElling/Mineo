import type { ISODateString } from '../../../types/branded';

/**
 * Deler ét carry-forward-opslag i en dato-sorteret reguleringsserie.
 *
 * Alle reguleringsformer der bærer en tidsserie af satser/indeks (statistik, KRL, KL,
 * manuel procentsats – i motor, præsentation og inspektion) skal finde "den gældende
 * værdi på en given dato". Semantikken er **carry-forward, on-or-before**: den seneste
 * post hvis `startIso <= date` gælder frem til næste post; falder datoen før første post,
 * findes ingen dækning (`undefined` – kaldstedet afgør fallback, fx basisrækken).
 *
 * Tidligere fandtes samme opslag som mindst fem parallelle udgaver – reverse-scan i motoren,
 * `.filter(<=).at(-1)` tre steder i præsentationen, og `.filter(<=).sort(desc)[0]` i
 * inspektionen – hvoraf de fire re-derivationer manglede sorterings-invarianten. Konsolideret
 * til ét sted (regulering-redesign R3), så carry-forward-politikken og "interiort hul umuligt"-
 * beviset kun findes ét sted og ikke kan drive fra hinanden.
 *
 * Bevidst afgrænsning: dette dækker udelukkende `ISODateString`-serier med
 * carry-forward-semantik. Datalagets `DanishDateString`-opslag (privat/offentlig overenskomst)
 * og de bevidst carry-forward-FRIE modeller (ASL/lovbestemte pr.-år-eksakt, sygedagpenge lukkede
 * intervaller) hører ikke til her – deres afvigelse er en domænesandhed, ikke drift.
 *
 * **Feltnavnet er ikke en del af aftalen.** Serier med samme semantik men et
 * andet datofeltnavn skal bruge `findLatestByDateKeyInSortedList` med en nøglevælger frem for
 * at re-derivere opslaget. Præcis den slags "næsten samme, men feltet heder noget andet"
 * er den vej, en parallel udgave opstår: en manuel lønudviklings-række bærer `startDato`,
 * og inspektionens indeksrækker bærer `dato`.
 */

/**
 * Sorterings-invariant for et carry-forward-opslag: ikke-aftagende dato.
 * Lige datoer er tilladt (fx manuel procentsats hvor en række dateret præcis på
 * basisdatoen ligger efter basis-entryen). Kaster ved usorteret data frem for at
 * returnere et forkert (tavst) opslag.
 */
export const assertSortedByDateKey = <T>(
  items: readonly T[],
  getDate: (item: T) => ISODateString,
  context: string
): void => {
  for (let i = 1; i < items.length; i += 1) {
    if (getDate(items[i - 1]) > getDate(items[i])) {
      throw new Error(`Intern fejl: usorteret startdato-liste (${context})`);
    }
  }
};

/**
 * Finder den seneste post med `getDate(post) <= date` i en stigende sorteret serie
 * (carry-forward). Returnerer `undefined` hvis `date` ligger før første post.
 *
 * Dette er kernen; `findLatestByDateInSortedList` nedenfor er den ergonomiske form for de
 * serier, der bruger kodebasens sædvanlige `startIso`-felt.
 */
export const findLatestByDateKeyInSortedList = <T>(
  sortedItems: readonly T[],
  date: ISODateString,
  getDate: (item: T) => ISODateString,
  context: string
): T | undefined => {
  assertSortedByDateKey(sortedItems, getDate, context);
  for (let i = sortedItems.length - 1; i >= 0; i -= 1) {
    if (getDate(sortedItems[i]) <= date) return sortedItems[i];
  }
  return undefined;
};

const getStartIso = <T extends { startIso: ISODateString }>(item: T): ISODateString => item.startIso;

/** Sorterings-invarianten for den sædvanlige `startIso`-form. */
export const assertSortedByStartIso = <T extends { startIso: ISODateString }>(
  items: readonly T[],
  context: string
): void => assertSortedByDateKey(items, getStartIso, context);

/**
 * Finder den seneste post med `startIso <= date` i en stigende sorteret serie
 * (carry-forward). Returnerer `undefined` hvis `date` ligger før første post.
 */
export const findLatestByDateInSortedList = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string
): T | undefined => findLatestByDateKeyInSortedList(sortedItems, date, getStartIso, context);
