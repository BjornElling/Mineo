import { ASL_AARSLOENSMAKSIMUM_MODEL_LABEL } from '../../../data/statistiskeRates';
import { statistikForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/statistikForm';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
  LoenudviklingAf,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const tafRanges = [{ fra: iso('2020-01-01'), til: iso('2026-12-31') }];

const statistikAf = (model: string): LoenudviklingAf => ({
  loenudviklingStatistikModel: model,
} as LoenudviklingAf);

const createContext = (model = 'ILON12 (Danmarks Statistik)'): FormKonsoliderContext => ({
  active: [statistikAf(model)],
  angivetLoen: true,
  anvendtReguleringsdato: iso('2020-06-01'),
  tafRanges,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

const createKonsolideret = (
  overrides: Partial<Extract<KonsolideretLoenudvikling, { strategi: 'statistik' }>> = {}
): Extract<KonsolideretLoenudvikling, { strategi: 'statistik' }> => ({
  strategi: 'statistik',
  label: 'ILON12 (Danmarks Statistik)',
  reguleringsdato: iso('2020-06-01'),
  statistikModel: 'ILON12 (Danmarks Statistik)',
  tafRanges,
  ...overrides,
});

describe('statistikForm', () => {
  it('konsoliderer en ensartet statistikmodel og afviser blandede modeller', () => {
    expect(statistikForm.konsolider(createContext())).toEqual({
      strategi: 'statistik',
      label: 'ILON12 (Danmarks Statistik)',
      konsolideret: createKonsolideret(),
    });

    expect(() => statistikForm.konsolider({
      ...createContext(),
      active: [statistikAf('ILON12 (Danmarks Statistik)'), statistikAf('SBLON2 (Danmarks Statistik)')],
    })).toThrow('Inkonsistente loenudviklingsindstillinger: statistikmodel');
  });

  it('bygger ASL-segmenter med zero-delta før basisåret og fail-closer ved manglende år', () => {
    const result = statistikForm.byggResultat(createKonsolideret({
      label: ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
      statistikModel: ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
      reguleringsdato: iso('2020-06-01'),
      tafRanges: [{ fra: iso('2019-01-01'), til: iso('2026-12-31') }],
    }));

    expect(result.forloeb).toBeUndefined();
    expect(result.segmenter.find((segment) => segment.fra === iso('2019-01-01'))?.deltaPct).toBe(0);
    expect(result.segmenter.find((segment) => segment.fra === iso('2021-01-01'))?.deltaPct).toBeGreaterThan(0);

    expect(() => statistikForm.byggResultat(createKonsolideret({
      label: ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
      statistikModel: ASL_AARSLOENSMAKSIMUM_MODEL_LABEL,
      tafRanges: [{ fra: iso('2020-01-01'), til: iso('2027-12-31') }],
    }))).toThrow('mangler ASL indeks for 2027');
  });

  it('bygger statistikforløb og afviser model-, dato- og tomheds-gates', () => {
    const result = statistikForm.byggResultat(createKonsolideret());

    expect(result.segmenter.length).toBeGreaterThan(0);
    expect(result.segmenter[0]?.deltaPct).toBe(0);
    expect(result.forloeb?.kind).toBe('statistik');

    expect(() => statistikForm.byggResultat({ ...createKonsolideret(), strategi: 'manual' } as never))
      .toThrow('statistikstrategi mangler');
    expect(() => statistikForm.byggResultat(createKonsolideret({ statistikModel: '' })))
      .toThrow('statistikmodel mangler');
    expect(() => statistikForm.byggResultat(createKonsolideret({ reguleringsdato: undefined })))
      .toThrow('reguleringsdato mangler');
    expect(() => statistikForm.byggResultat(createKonsolideret({ statistikModel: 'ukendt statistikmodel' })))
      .toThrow('ukendt statistikmodel');
    expect(() => statistikForm.byggResultat(createKonsolideret({ tafRanges: [] })))
      .toThrow('ingen statistiksegmenter');
  });

  it('giver zero-delta for statistiksegmenter før den effektive basisdato', () => {
    const result = statistikForm.byggResultat(createKonsolideret({
      tafRanges: [{ fra: iso('2019-01-01'), til: iso('2020-06-30') }],
    }));

    expect(result.segmenter).toEqual([
      { fra: iso('2019-01-01'), til: iso('2019-12-31'), deltaPct: 0 },
      { fra: iso('2020-01-01'), til: iso('2020-06-30'), deltaPct: 0 },
    ]);
  });

  it('projicerer statistikmodellens kildedækning', () => {
    expect(statistikForm.coverageInterval(statistikAf('ILON12 (Danmarks Statistik)'))).toEqual({
      fraIso: iso('2005-01-01'),
      tilIso: iso('2026-09-30'),
    });
    expect(statistikForm.coverageInterval(statistikAf(ASL_AARSLOENSMAKSIMUM_MODEL_LABEL))).toEqual({
      fraIso: iso('2005-01-01'),
      tilIso: iso('2026-12-31'),
    });
    expect(statistikForm.coverageInterval(statistikAf('ukendt statistikmodel'))).toBeUndefined();
  });
});
