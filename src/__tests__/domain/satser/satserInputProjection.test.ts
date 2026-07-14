import { buildSatserInputProjection } from '../../../domain/satser/satserInputProjection';

describe('buildSatserInputProjection', () => {
  it('maskerer den tidligere committede årgang ved afsluttet ugyldigt input', () => {
    const projection = buildSatserInputProjection({
      values: { aargang: 2024 },
      aargangInvalidDraft: 'ikke et år',
      minYear: 2000,
      maxYear: 2026,
      revision: 7,
    });

    expect(projection.status).toBe('blocked');
    if (projection.status === 'blocked') {
      expect(projection.blockers).toEqual([
        expect.objectContaining({ fieldId: 'aargang', reason: 'invalid' }),
      ]);
      expect(projection).not.toHaveProperty('data');
    }
  });

  it('afviser år uden for intervallet og danner kun data for en gyldig årgang', () => {
    const blocked = buildSatserInputProjection({
      values: { aargang: 1999 },
      aargangInvalidDraft: undefined,
      minYear: 2000,
      maxYear: 2026,
      revision: 8,
    });
    expect(blocked.status).toBe('blocked');

    const ready = buildSatserInputProjection({
      values: { aargang: 2024 },
      aargangInvalidDraft: undefined,
      minYear: 2000,
      maxYear: 2026,
      revision: 9,
    });
    expect(ready.status).toBe('ready');
    if (ready.status === 'ready') {
      expect(ready.data.year).toBe(2024);
      expect(ready.data.satser).toBeDefined();
      expect(ready.revision).toBe(9);
    }
  });
});
