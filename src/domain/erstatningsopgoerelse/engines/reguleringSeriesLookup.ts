import type { ISODateString } from '../../../types/branded';

/**
 * Deler ét carry-forward-opslag i en dato-sorteret reguleringsserie.
 *
 * Alle reguleringsformer der bærer en tidsserie af satser/indeks (statistik, KRL, KL,
 * manuel procentsats — i motor, præsentation og inspektion) skal finde "den gældende
 * værdi på en given dato". Semantikken er **carry-forward, on-or-before**: den seneste
 * post hvis `startIso <= date` gælder frem til næste post; falder datoen før første post,
 * findes ingen dækning (`undefined` — kaldstedet afgør fallback, fx basisrækken).
 *
 * Tidligere fandtes samme opslag som mindst fem parallelle udgaver — reverse-scan i motoren,
 * `.filter(<=).at(-1)` tre steder i præsentationen, og `.filter(<=).sort(desc)[0]` i
 * inspektionen — hvoraf de fire re-derivationer manglede sorterings-invarianten. Konsolideret
 * til ét sted (regulering-redesign R3), så carry-forward-politikken og "interiort hul umuligt"-
 * beviset kun findes ét sted og ikke kan drive fra hinanden.
 *
 * Bevidst afgrænsning: dette dækker udelukkende `ISODateString`-serier med
 * carry-forward-semantik. Datalagets `DanishDateString`-opslag (privat/offentlig overenskomst)
 * og de bevidst carry-forward-FRIE modeller (ASL/lovbestemte pr.-år-eksakt, sygedagpenge lukkede
 * intervaller) hører ikke til her — deres afvigelse er en domænesandhed, ikke drift.
 */

/**
 * Sorterings-invariant for et carry-forward-opslag: ikke-aftagende `startIso`.
 * Lige `startIso` er tilladt (fx manuel procentsats hvor en række dateret præcis på
 * basisdatoen ligger efter basis-entryen). Kaster ved usorteret data frem for at
 * returnere et forkert (tavst) opslag.
 */
export const assertSortedByStartIso = <T extends { startIso: ISODateString }>(
  items: readonly T[],
  context: string
): void => {
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].startIso > items[i].startIso) {
      throw new Error(`Intern fejl: usorteret startdato-liste (${context})`);
    }
  }
};

/**
 * Finder den seneste post med `startIso <= date` i en stigende sorteret serie
 * (carry-forward). Returnerer `undefined` hvis `date` ligger før første post.
 */
export const findLatestByDateInSortedList = <T extends { startIso: ISODateString }>(
  sortedItems: readonly T[],
  date: ISODateString,
  context: string
): T | undefined => {
  assertSortedByStartIso(sortedItems, context);
  for (let i = sortedItems.length - 1; i >= 0; i -= 1) {
    if (sortedItems[i].startIso <= date) return sortedItems[i];
  }
  return undefined;
};
