import { moneyOre } from '../../../domain/money/money';

import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import { buildTafPerYearAfrundingInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';

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
          blocksOutputs: ['beregning', 'eo_pdf', 'taf_per_year_pdf'],
        },
        buildTafPerYearAfrundingInvariant({
          afrundingOre: moneyOre(125),
          sumYearTafOre: moneyOre(1000),
          samletTafKravOre: moneyOre(1125),
        }),
      ],
      data: null,
      input: {
        stamdata: null,
        erstatningsopgoerelse: null,
      },
    } as const;

    const view = eoSnapshotToBeregningView(snapshot);

    expect(view.invariants).toEqual(snapshot.invariants);
    expect(view.authoritativeBlockingInvariants.map((invariant) => invariant.id)).toEqual(['validation:block']);
  });

  describe('fald-tilbage til readyBranches', () => {
    const baseSnapshot = {
      revision: 'rev-1',
      status: 'error',
      invariants: [],
      data: null,
      input: { stamdata: null, erstatningsopgoerelse: null },
    } as const;

    const range = { fra: '2024-01-01', til: '2024-06-30' } as const;

    it('viser den gyldige TAF-periodisering, når kun en FREMMED gren er blokeret', () => {
      const view = eoSnapshotToBeregningView({
        ...baseSnapshot,
        readyBranches: { svieSmerte: undefined, tafPerioder: [range] },
      } as never);

      expect(view.tafPerioder).toEqual([range]);
      // Aggregatet er stadig ikke autoritativt: summer og totaler vises som `-`.
      expect(view.canonicalOutput).toBeUndefined();
    });

    it('viser INTET, når TAF-grenen selv er blokeret', () => {
      const view = eoSnapshotToBeregningView({
        ...baseSnapshot,
        readyBranches: { svieSmerte: undefined, tafPerioder: undefined },
      } as never);

      expect(view.tafPerioder).toEqual([]);
    });

    it('viser INTET på en fail-closed sti, hvor ingen gren blev vurderet', () => {
      // `readyBranches` sættes kun på den gatede fejlsti. Uden feltet må fanen ikke gætte en periodisering.
      const view = eoSnapshotToBeregningView({
        ...baseSnapshot,
        status: 'fail_closed',
        failClosedReason: 'schema_guard',
      } as never);

      expect(view.tafPerioder).toEqual([]);
      expect(view.canonicalOutput).toBeUndefined();
    });
  });
});
