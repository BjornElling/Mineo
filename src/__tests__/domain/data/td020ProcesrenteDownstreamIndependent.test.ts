import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { computeRenteberegning } from '../../../domain/renteberegning/renteberegningEngine';
import { toISODateString } from '../../../types/branded';

/**
 * TD-020: uafhængigt downstream-facit for den faktiske procesrente-forbruger.
 *
 * Facit er skrevet direkte ud fra rentesatserne og kalenderen, ikke gennem
 * procesrente-helperen eller en anden produktionsprojektion.
 */
describe('TD-020 – procesrente med faktiske rentesatser', () => {
  it('fører de faktiske 2024-satser gennem aggregationsmotoren', () => {
    const output = computeRenteberegning({
      renteberegning: {
        beregningsdato: toISODateString('2024-07-02'),
        rentekravRows: [
          {
            id: 'td020-interest',
            belob: { kind: 'number', value: 100_000 },
            renterFra: toISODateString('2024-06-30'),
            tillaegstid: 0,
            enhed: 'dage',
          },
        ],
      },
      referenceRates,
      surchargeRates,
    });

    const row = output.rows[0];
    expect(row?.actualInterestDate).toBe(toISODateString('2024-06-30'));
    // 2024 er et skudår: 11750 · 1 / 366 + 11500 · 2 / 366 = 94,945355...
    expect(row?.calculatedInterest).toBe(94.95);
    expect(row?.periods).toEqual([
      {
        startDate: new Date('2024-06-30T00:00:00.000Z'),
        endDate: new Date('2024-06-30T00:00:00.000Z'),
        amount: 100_000,
        referenceRatePct: 3.75,
        surchargeRatePct: 8,
        totalRatePct: 11.75,
        days: 1,
        interest: expect.closeTo(32.10382513661202, 12),
      },
      {
        startDate: new Date('2024-07-01T00:00:00.000Z'),
        endDate: new Date('2024-07-02T00:00:00.000Z'),
        amount: 100_000,
        referenceRatePct: 3.5,
        surchargeRatePct: 8,
        totalRatePct: 11.5,
        days: 2,
        interest: expect.closeTo(62.84153005464481, 12),
      },
    ]);
  });
});
