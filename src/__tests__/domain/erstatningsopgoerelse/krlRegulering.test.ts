import type { KRLSatstabelId } from '../../../data/krlRates';

const krlMocks = vi.hoisted(() => ({
  getKRLSatstabel: vi.fn(),
}));

vi.mock('../../../data/krlRates', () => ({
  getKRLSatstabel: krlMocks.getKRLSatstabel,
}));

import { buildKrlIndexEntries } from '../../../domain/erstatningsopgoerelse/engines/krlRegulering';

const KRL_ID: KRLSatstabelId = 'KTO (kommuner)';

describe('buildKrlIndexEntries', () => {
  beforeEach(() => {
    krlMocks.getKRLSatstabel.mockReset();
  });

  it('returnerer tom serie når KRL-tabellen mangler', () => {
    krlMocks.getKRLSatstabel.mockReturnValue(undefined);

    expect(buildKrlIndexEntries(KRL_ID)).toEqual([]);
  });

  it('returnerer tom serie når KRL-tabellen er tom', () => {
    krlMocks.getKRLSatstabel.mockReturnValue({ vaerdier: [] });

    expect(buildKrlIndexEntries(KRL_ID)).toEqual([]);
  });

  it('sorterer gyldige perioder stigende og kasserer ugyldige datoer', () => {
    krlMocks.getKRLSatstabel.mockReturnValue({
      vaerdier: [
        { fraDato: '01-04-2026', reguleringsPct: 2.5 },
        { fraDato: '01-04-2024', reguleringsPct: 1.25 },
        { fraDato: 'ikke-en-dato', reguleringsPct: 99 },
      ],
    });

    expect(buildKrlIndexEntries(KRL_ID)).toEqual([
      { startIso: '2024-04-01', reguleringsPct: 1.25 },
      { startIso: '2026-04-01', reguleringsPct: 2.5 },
    ]);
  });
});
