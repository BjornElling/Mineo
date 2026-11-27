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
 * `readyBranches` leverer den gyldige TAF-periodisering ved fejl i en uafhængig gren.
 * Samlede tal kommer fra `canonicalOutput`, som kræver hele beregningen.
 */
export const eoSnapshotToBeregningView = (snapshot: EoSnapshot): EoBeregningView => ({
  invariants: snapshot.invariants,
  authoritativeBlockingInvariants: getAuthoritativeBlockingInvariants(snapshot.invariants),
  tafPerioder: snapshot.data?.canonicalOutput.periodiseringer.tafPerioder
    ?? snapshot.readyBranches?.tafPerioder
    ?? [],
  canonicalOutput: snapshot.data?.canonicalOutput,
});
