import type { EoSnapshot } from './eoSnapshot';
import { getAuthoritativeBlockingInvariants, getBlockingInvariantsForOutput } from './eoSnapshotInvariants';

export type EoBeregningView = Readonly<{
  invariants: EoSnapshot['invariants'];
  authoritativeBlockingInvariants: ReturnType<typeof getAuthoritativeBlockingInvariants>;
  eoPdfBlockingInvariants: ReturnType<typeof getBlockingInvariantsForOutput>;
  tafPerYearPdfBlockingInvariants: ReturnType<typeof getBlockingInvariantsForOutput>;
}>;

export const eoSnapshotToBeregningView = (snapshot: EoSnapshot): EoBeregningView => ({
  invariants: snapshot.invariants,
  authoritativeBlockingInvariants: getAuthoritativeBlockingInvariants(snapshot.invariants),
  eoPdfBlockingInvariants: getBlockingInvariantsForOutput(snapshot.invariants, 'eo_pdf'),
  tafPerYearPdfBlockingInvariants: getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_pdf'),
});
