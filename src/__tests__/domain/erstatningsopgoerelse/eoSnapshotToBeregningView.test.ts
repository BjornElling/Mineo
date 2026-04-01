
import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import { buildControlMismatchInvariant, buildTafPerYearAfrundingInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';

describe('eoSnapshotToBeregningView', () => {
  it('filtrerer autoritative blokeringer deterministisk og bevarer snapshot-invarianter', () => {
    const snapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [
        {
          id: 'validation:block',
          passed: false,
          severity: 'error',
          source: 'validation' as const,
          message: 'Autoritativ fejl',
          blocksAuthoritativeComputation: true,
          blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'],
        },
        buildControlMismatchInvariant(['Mismatch']),
        buildTafPerYearAfrundingInvariant({
          afrundingOre: 125,
          sumYearTafOre: 1000,
          samletTafKravOre: 1125,
        }),
      ],
    } as const;

    const view = eoSnapshotToBeregningView(snapshot);

    expect(view.invariants).toEqual(snapshot.invariants);
    expect(view.authoritativeBlockingInvariants.map((invariant) => invariant.id)).toEqual(['validation:block']);
  });
});
