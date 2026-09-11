import { statistikForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/statistikForm';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);

describe('DATA-001/TD-020 – ILON12 som downstream-facit', () => {
  it('fører 2025K1- og 2025K4-indeks gennem statistikformen', () => {
    const resultat = statistikForm.byggResultat({
      strategi: 'statistik',
      label: 'ILON12 (Danmarks Statistik)',
      reguleringsdato: iso('2025-05-01'),
      statistikModel: 'ILON12 (Danmarks Statistik)',
      tafRanges: [{ fra: iso('2025-05-01'), til: iso('2026-09-30') }],
    });

    // Basis = 2025K1 (161,5). Seneste indeks = 2025K4 (165,2),
    // så deltaPct = (165,2 / 161,5 − 1) × 100 = 2,29 %.
    expect(resultat.segmenter.map(({ fra, til, deltaPct }) => ({ fra, til, deltaPct }))).toEqual([
      { fra: iso('2025-05-01'), til: iso('2025-09-30'), deltaPct: 0 },
      { fra: iso('2025-10-01'), til: iso('2026-09-30'), deltaPct: 2.29 },
    ]);

    const forloeb = resultat.forloeb;
    expect(forloeb?.kind).toBe('statistik');
    if (!forloeb || forloeb.kind !== 'statistik') {
      throw new Error('Forventede et statistisk reguleringsforløb');
    }
    expect(forloeb.displayDecimals).toBe(1);
    expect(forloeb.entries.filter(({ kvartal }) => kvartal === '2025K1' || kvartal === '2025K4'))
      .toEqual([
        { startIso: iso('2025-01-01'), kvartal: '2025K1', indeksvaerdi: 161.5 },
        { startIso: iso('2025-10-01'), kvartal: '2025K4', indeksvaerdi: 165.2 },
      ]);
  });
});
