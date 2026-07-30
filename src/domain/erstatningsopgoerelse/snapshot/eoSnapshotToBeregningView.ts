import type { EoSnapshot } from './eoSnapshot';
import { getAuthoritativeBlockingInvariants } from './eoSnapshotInvariants';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import type { EoCanonicalOutput } from './eoCanonicalOutput';

export type EoBeregningView = Readonly<{
  invariants: EoSnapshot['invariants'];
  authoritativeBlockingInvariants: ReturnType<typeof getAuthoritativeBlockingInvariants>;
  tafPerioder: readonly IsoRange[];
  canonicalOutput: EoCanonicalOutput | undefined;
}>;

/**
 * Beregning-fanens projektion af snapshottet.
 *
 * `tafPerioder` falder tilbage til den UAFHÆNGIGE TAF-gren, når aggregatet er blokeret. Uden det fald-tilbage forsvandt en fuldstændig GYLDIG TAF-periodisering fra fanen,
 * så snart et svie/smerte-felt var rødt: `data` er `null` på den blokerede sti, og fanen ser ikke
 * `inspektionSnapshot`. Brugerbeslutning 2 (2026-07-25) forbyder netop det.
 *
 * ⚠️ `canonicalOutput` har BEVIDST intet fald-tilbage: det er det krydsgående aggregat, og et canonical
 * output uden alle led ville ikke være autoritativt (valgt model A). Fanen viser derfor fortsat `-` for
 * summer og totaler, mens den gyldige periodisering består.
 */
export const eoSnapshotToBeregningView = (snapshot: EoSnapshot): EoBeregningView => ({
  invariants: snapshot.invariants,
  authoritativeBlockingInvariants: getAuthoritativeBlockingInvariants(snapshot.invariants),
  tafPerioder: snapshot.data?.canonicalOutput.periodiseringer.tafPerioder
    ?? snapshot.readyBranches?.tafPerioder
    ?? [],
  canonicalOutput: snapshot.data?.canonicalOutput,
});
