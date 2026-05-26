import { downloadAllStandaloneRentePdf, downloadStandaloneRentePdf } from '../../pdf/infrastructure/standaloneRentePdfService';
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';

const makePeriod = (): ProcessInterestPeriod => ({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-30'),
  amount: 1000,
  referenceRatePct: 4.25,
  surchargeRatePct: 8,
  totalRatePct: 12.25,
  days: 181,
  interest: 60.87,
});

const ROW = {
  beloeb: 1000,
  actualInterestDate: '01-01-2024',
  beregningsdato: '30-06-2024',
  periods: [makePeriod()],
  latestReferenceRateDate: null,
};

describe('downloadAllStandaloneRentePdf', () => {
  it('returnerer fejl ved 0 rækker', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });

  it('returnerer success ved 1 række med gyldige perioder', async () => {
    const result = await downloadAllStandaloneRentePdf({ rows: [ROW] });
    expect(result.success).toBe(true);
  });

  it('returnerer success ved 2 rækker', async () => {
    const result = await downloadAllStandaloneRentePdf({
      rows: [ROW, { ...ROW, beloeb: 2000 }],
    });
    expect(result.success).toBe(true);
  });
});

describe('downloadStandaloneRentePdf', () => {
  it('returnerer success ved gyldige parametre', async () => {
    const result = await downloadStandaloneRentePdf({
      beloeb: 1000,
      actualInterestDate: '01-01-2024',
      beregningsdato: '30-06-2024',
      periods: [makePeriod()],
      latestReferenceRateDate: null,
    });
    expect(result.success).toBe(true);
  });

  it('returnerer fejl ved tomme perioder', async () => {
    const result = await downloadStandaloneRentePdf({
      beloeb: 1000,
      actualInterestDate: '01-01-2024',
      beregningsdato: '30-06-2024',
      periods: [],
      latestReferenceRateDate: null,
    });
    expect(result.success).toBe(false);
  });
});
