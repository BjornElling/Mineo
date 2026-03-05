import { describe, expect, it } from 'vitest';

import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/eoSnapshotToBeregningView';
import {
  buildControlMismatchInvariant,
  buildTafPerYearAfrundingInvariant,
} from '../../../domain/erstatningsopgoerelse/eoSnapshotInvariants';

describe('eoSnapshotToBeregningView', () => {
  it('filtrerer autoritative og output-specifikke blokeringer deterministisk', () => {
    const snapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [
        {
          id: 'validation:block',
          passed: false,
          severity: 'error',
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

    expect(view.authoritativeBlockingInvariants.map((invariant) => invariant.id)).toEqual(['validation:block']);
    expect(view.eoPdfBlockingInvariants.map((invariant) => invariant.id)).toEqual([
      'validation:block',
      'debug:control_mismatch',
    ]);
    expect(view.tafPerYearPdfBlockingInvariants.map((invariant) => invariant.id)).toEqual([
      'validation:block',
      'debug:control_mismatch',
      'taf_per_year:afrunding_over_100',
    ]);
  });
});
