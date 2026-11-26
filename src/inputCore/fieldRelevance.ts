import { serializeFieldAddress, type CollectionRef } from './fieldAddress';
import type { CanonicalView, FieldRef } from './fieldDescriptor';
import type { RejectedInputs } from './settledInput';

/**
 * Et felts relevans i én inputtilstand (form-contract §7.5–§7.6).
 *
 * - `relevant` – feltet vises og læses.
 * - `irrelevant` – feltet er skjult, fordi brugerens AFSLUTTEDE input gør det irrelevant (fx TAF «Nej», en
 *   beregningsperiode, der opgøres i måneder). Rød fejl ryddes ved overgangen hertil (§7.5 pkt. 2).
 * - `ubestemt` – relevansreglen svarede «ikke relevant», men svaret byggede på et felt med afvist råtekst. Den
 *   ugyldige indtastning har tomt canonical slot (XOR-invarianten), så reglen kunne ikke kende brugerens reelle
 *   valg: svaret er en midlertidig konsekvens af en fejl ANDETSTEDS, ikke et valg. Feltet er skjult og
 *   læses som tomt som et irrelevant felt, men dets afviste råtekst BEVARES.
 *
 * Hvorfor ubestemt ikke må rydde: rydningen af skjult+rødt findes, fordi en usynlig rød fejl ellers kunne spærre
 * Gem uden et felt at pege på. Ved `ubestemt` er det ikke tilfældet – den afviste årsag spærrer selv Gem, og
 * når brugeren retter den, kommer feltet til syne igen med sin indtastning. Ryddes årsagen i stedet ved et valg,
 * bliver feltet `irrelevant`, og reduceren rydder det da i samme transaktion.
 */
export type RelevanceStatus = 'relevant' | 'irrelevant' | 'ubestemt';

/** Læsesporing pr. view: en stak af «har læst afvist råtekst»-flag, ét pr. igangværende relevansvurdering. */
type RejectedReadTracking = { scopes: boolean[] };

const trackingByView = new WeakMap<CanonicalView, RejectedReadTracking>();

const markRejectedRead = (tracking: RejectedReadTracking): void => {
  const top = tracking.scopes.length - 1;
  if (top >= 0) tracking.scopes[top] = true;
};

/**
 * Danner den `CanonicalView`, relevansregler vurderes på. Viewet sporer selv, om en regel læste et felt med
 * afvist råtekst – reglerne behøver derfor ikke kende til rejected input, og ingen regel kan glemme det.
 */
export const createRelevanceTrackingView = (options: Readonly<{
  readCanonical: <V>(field: FieldRef<V>) => V;
  listEntityIds: (collection: CollectionRef) => readonly string[];
  rejectedInputs: RejectedInputs;
}>): CanonicalView => {
  const tracking: RejectedReadTracking = { scopes: [] };
  // Langt de fleste tilstande har ingen afvist råtekst. Så springes adresseserialiseringen (en schema-parse pr.
  // læst felt) helt over – relevansreglerne læser ved hver reader-dannelse hele lønindkomsttræet.
  const hasAnyRejected = Object.keys(options.rejectedInputs).length > 0;
  const view: CanonicalView = Object.freeze({
    readCanonical: <V>(field: FieldRef<V>): V => {
      const value = options.readCanonical(field);
      if (hasAnyRejected
        && tracking.scopes.length > 0
        && options.rejectedInputs[serializeFieldAddress(field.address)] !== undefined) {
        markRejectedRead(tracking);
      }
      return value;
    },
    listEntityIds: options.listEntityIds,
  });
  trackingByView.set(view, tracking);
  return view;
};

/** Kører `evaluate` i et eget sporingsscope og videregiver en afvist læsning til et omsluttende scope. */
const withRejectedReadTracking = <R>(
  view: CanonicalView,
  evaluate: () => R
): Readonly<{ value: R; readRejected: boolean }> => {
  const tracking = trackingByView.get(view);
  if (tracking === undefined) return { value: evaluate(), readRejected: false };
  tracking.scopes.push(false);
  let readRejected = false;
  try {
    const value = evaluate();
    readRejected = tracking.scopes[tracking.scopes.length - 1] === true;
    return { value, readRejected };
  } finally {
    tracking.scopes.pop();
    if (readRejected) markRejectedRead(tracking);
  }
};

/** Feltets relevansstatus. Et felt uden relevansregel er altid relevant. */
export const resolveRelevanceStatus = <T>(field: FieldRef<T>, view: CanonicalView): RelevanceStatus => {
  const rule = field.descriptor.relevance;
  if (rule === undefined) return 'relevant';
  const { value, readRejected } = withRejectedReadTracking(view, () => rule(field, view));
  if (value) return 'relevant';
  return readRejected ? 'ubestemt' : 'irrelevant';
};

/**
 * Husker en relevansafgørelse pr. view (et view er bundet til én uændrelig inputtilstand). Til regler, der læser
 * meget – fx beregningsenheden, som læser hele lønindkomsttræet – og kaldes for mange felter.
 *
 * Et almindeligt `WeakMap`-cache ville ødelægge læsesporingen: ved et cache-hit læser reglen intet, og et svar,
 * der byggede på afvist råtekst, ville se ud som et bevidst valg – så rydningen ramte netop det input, sporingen
 * skal beskytte. Cachen gemmer derfor også, om svaret læste afvist råtekst, og melder det igen ved hvert hit.
 */
export const memoizeRelevancePerView = (
  evaluate: (view: CanonicalView) => boolean
): ((view: CanonicalView) => boolean) => {
  const cache = new WeakMap<CanonicalView, Readonly<{ value: boolean; readRejected: boolean }>>();
  return (view) => {
    const cached = cache.get(view);
    if (cached !== undefined) {
      if (cached.readRejected) {
        const tracking = trackingByView.get(view);
        if (tracking !== undefined) markRejectedRead(tracking);
      }
      return cached.value;
    }
    const result = withRejectedReadTracking(view, () => evaluate(view));
    cache.set(view, result);
    return result.value;
  };
};
