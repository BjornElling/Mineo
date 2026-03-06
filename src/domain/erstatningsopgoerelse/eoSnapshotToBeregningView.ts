import type { EoSnapshot } from './eoSnapshot';
import { getAuthoritativeBlockingInvariants } from './eoSnapshotInvariants';

export type EoBeregningView = Readonly<{
  invariants: EoSnapshot['invariants'];
  authoritativeBlockingInvariants: ReturnType<typeof getAuthoritativeBlockingInvariants>;
}>;

export const eoSnapshotToBeregningView = (snapshot: EoSnapshot): EoBeregningView => ({
  invariants: snapshot.invariants,
  authoritativeBlockingInvariants: getAuthoritativeBlockingInvariants(snapshot.invariants),
});
