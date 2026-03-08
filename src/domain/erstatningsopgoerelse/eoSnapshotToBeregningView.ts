import type { EoSnapshot } from './eoSnapshot';
import { getAuthoritativeBlockingInvariants } from './eoSnapshotInvariants';
import type { IsoRange } from './tafPeriodConstraints';
import type { EoCanonicalOutput } from './eoCanonicalOutput';

export type EoBeregningView = Readonly<{
  invariants: EoSnapshot['invariants'];
  authoritativeBlockingInvariants: ReturnType<typeof getAuthoritativeBlockingInvariants>;
  tafPerioder: readonly IsoRange[];
  canonicalOutput: EoCanonicalOutput | undefined;
}>;

export const eoSnapshotToBeregningView = (snapshot: EoSnapshot): EoBeregningView => ({
  invariants: snapshot.invariants,
  authoritativeBlockingInvariants: getAuthoritativeBlockingInvariants(snapshot.invariants),
  tafPerioder: snapshot.data?.canonicalOutput.periodiseringer.tafPerioder ?? [],
  canonicalOutput: snapshot.data?.canonicalOutput,
});
