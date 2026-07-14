import { buildCellInvalidDraftFieldPath, CELL_TABLE_IDS } from '../../../config/cellInvalidDraftScopes';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { buildRenteberegningInputProjection } from '../../../domain/renteberegning/renteberegningInputProjection';
import type { RentekravRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const createRow = (id: string): RentekravRow => ({
  id,
  belob: { kind: 'number', value: 1_000 },
  renterFra: toISODateString('2024-01-01'),
  tillaegstid: 0,
  enhed: 'dage',
});

describe('buildRenteberegningInputProjection', () => {
  it('beregner ikke data for en blokeret række, men bevarer en anden rækkes ready-projektion', () => {
    const projection = buildRenteberegningInputProjection({
      beregningsdato: toISODateString('2024-12-31'),
      committedRentekravById: new Map([
        ['r1', createRow('r1')],
        ['r2', createRow('r2')],
      ]),
      invalidDrafts: {
        [buildCellInvalidDraftFieldPath(CELL_TABLE_IDS.renteBeregnet, '', 'r2:0')]: 'ugyldig',
      },
      referenceRates,
      surchargeRates,
      revision: 11,
    });

    expect(projection.rowProjections.get('r1')?.status).toBe('ready');
    const blockedRow = projection.rowProjections.get('r2');
    expect(blockedRow?.status).toBe('blocked');
    expect(blockedRow).not.toHaveProperty('data');
    expect(projection.aggregateProjection.status).toBe('blocked');
  });

  it('en ugyldig global beregningsdato maskerer alle rækker', () => {
    const projection = buildRenteberegningInputProjection({
      beregningsdato: toISODateString('2024-12-31'),
      committedRentekravById: new Map([['r1', createRow('r1')]]),
      invalidDrafts: { beregningsdato: '31-02-2024' },
      referenceRates,
      surchargeRates,
      revision: 12,
    });

    expect(projection.rowProjections.get('r1')?.status).toBe('blocked');
    expect(projection.aggregateProjection.status).toBe('blocked');
  });
});
