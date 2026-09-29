import * as krlRates from '../../../data/krlRates';
import { krlForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/krlForm';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
  LoenudviklingAf,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { toDanishDateString, toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const tafRanges = [{ fra: iso('2020-01-01'), til: iso('2026-12-31') }];

const krlAf = (id?: string): LoenudviklingAf => ({
  loenudviklingKRLSatstabel: id,
} as LoenudviklingAf);

const createContext = (id = 'KTO (kommuner)'): FormKonsoliderContext => ({
  active: [krlAf(id)],
  angivetLoen: true,
  anvendtReguleringsdato: iso('2020-06-01'),
  tafRanges,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

const createKonsolideret = (
  overrides: Partial<Extract<KonsolideretLoenudvikling, { strategi: 'krl' }>> = {}
): Extract<KonsolideretLoenudvikling, { strategi: 'krl' }> => ({
  strategi: 'krl',
  label: 'KTO (kommuner)',
  reguleringsdato: iso('2020-06-01'),
  krlSatstabelId: 'KTO (kommuner)',
  tafRanges,
  ...overrides,
});

describe('krlForm', () => {
  afterEach(() => vi.restoreAllMocks());

  it('konsoliderer en ensartet KRL-satstabel og afviser manglende eller blandede valg', () => {
    expect(krlForm.konsolider(createContext())).toEqual({
      strategi: 'krl',
      label: 'KTO (kommuner)',
      konsolideret: createKonsolideret(),
    });

    expect(() => krlForm.konsolider({
      ...createContext(),
      active: [krlAf('KTO (kommuner)'), krlAf('SHK (kommuner)')],
    })).toThrow('Inkonsistente loenudviklingsindstillinger: KRL satstabel');
    expect(() => krlForm.konsolider({ ...createContext(), active: [krlAf()] }))
      .toThrow('KRL satstabel mangler');
  });

  it('bygger KRL-segmenter og bærer den autoritative satsserie som forløb', () => {
    const result = krlForm.byggResultat(createKonsolideret({
      reguleringsdato: iso('2019-06-01'),
      tafRanges: [{ fra: iso('2018-01-01'), til: iso('2020-12-31') }],
    }));

    expect(result.segmenter.length).toBeGreaterThan(0);
    expect(result.segmenter.find((segment) => segment.fra === iso('2018-01-01'))?.deltaPct).toBe(0);
    expect(result.forloeb?.kind).toBe('krl');
    if (result.forloeb?.kind !== 'krl') throw new Error('KRL-forløb mangler');
    expect(result.forloeb.entries.length).toBeGreaterThan(0);
    expect(result.forloeb.entries[0]?.startIso).toBe(iso('2001-04-01'));
  });

  it('afviser strategi-, dato-, tabel- og tomheds-gates', () => {
    expect(() => krlForm.byggResultat({ ...createKonsolideret(), strategi: 'manual' } as never))
      .toThrow('KRL-strategi mangler');
    expect(() => krlForm.byggResultat(createKonsolideret({ reguleringsdato: undefined })))
      .toThrow('reguleringsdato mangler');
    expect(() => krlForm.byggResultat({
      ...createKonsolideret(),
      krlSatstabelId: 'ukendt' as never,
    })).toThrow('KRL satstabel mangler');
    expect(() => krlForm.byggResultat(createKonsolideret({ tafRanges: [] })))
      .toThrow('ingen KRL segmenter');
  });

  it('afviser ugyldigt basis- og segmentindeks fra en korrupt satstabel', () => {
    vi.spyOn(krlRates, 'getKRLSatstabel').mockReturnValue({
      id: 'KTO (kommuner)',
      navn: 'KTO (kommuner)',
      vaerdier: [{ fraDato: toDanishDateString('01-01-2020'), reguleringsPct: -100 }],
    });
    expect(() => krlForm.byggResultat(createKonsolideret({
      reguleringsdato: iso('2020-06-01'),
      tafRanges: [{ fra: iso('2020-06-01'), til: iso('2020-12-31') }],
    }))).toThrow('ugyldigt KRL basisindeks');

    vi.spyOn(krlRates, 'getKRLSatstabel').mockReturnValue({
      id: 'KTO (kommuner)',
      navn: 'KTO (kommuner)',
      vaerdier: [
        { fraDato: toDanishDateString('01-01-2020'), reguleringsPct: 0 },
        { fraDato: toDanishDateString('01-01-2021'), reguleringsPct: -100 },
      ],
    });
    expect(() => krlForm.byggResultat(createKonsolideret({
      reguleringsdato: iso('2020-06-01'),
      tafRanges: [{ fra: iso('2020-06-01'), til: iso('2021-12-31') }],
    }))).toThrow('ugyldigt KRL indeks for segment');
  });

  it('projicerer KRL-satstabellens kildedækning', () => {
    expect(krlForm.coverageInterval(krlAf('KTO (kommuner)'))).toEqual({
      fraIso: iso('2001-04-01'),
      tilIso: iso('2026-09-30'),
    });
    expect(krlForm.coverageInterval(krlAf('ukendt'))).toBeUndefined();
    expect(krlForm.coverageInterval(krlAf())).toBeUndefined();
  });
});
