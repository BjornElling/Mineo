import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { manuelForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/manuelForm';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
  LoenudviklingAf,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { toISODateString, type ISODateString } from '../../../types/branded';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string): ISODateString => toISODateString(value);

type ManualRow = NonNullable<LoenudviklingAf['loenudviklingManuelTableData']>[number];

const row = (id: string, dato: string | undefined, grundloen: number, feriepenge = 0): ManualRow => ({
  id,
  dato: dato ? iso(dato) : undefined,
  grundloen: asAmount(grundloen),
  feriepenge,
  shSoSats: 0,
  fritvalg: 0,
  agPension: 0,
});

const manualAf = (overrides: Readonly<Record<string, unknown>> = {}): LoenudviklingAf => ({
  loenudviklingManuelNavn: '  Egen løn  ',
  loenudviklingManuelTableData: [row('base', '2023-01-01', 1000)],
  loenPaaHelligdage: 'Almindelig løn',
  beregnStoreBededagstillaeg: true,
  tillaegAngivesSom: 'procent',
  feriePct: 12.5,
  indtaegtsoplysningerTableData: [{ col2: asAmount(30000) }],
  ...overrides,
} as LoenudviklingAf);

const createContext = (active: readonly LoenudviklingAf[] = [manualAf()]): FormKonsoliderContext => ({
  active,
  angivetLoen: true,
  anvendtReguleringsdato: iso('2023-01-01'),
  tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }],
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

const createKonsolideret = (
  overrides: Partial<Extract<KonsolideretLoenudvikling, { strategi: 'manual' }>> = {}
): Extract<KonsolideretLoenudvikling, { strategi: 'manual' }> => ({
  strategi: 'manual',
  label: 'Egen løn',
  reguleringsdato: iso('2023-01-01'),
  loenPaaHelligdage: 'Almindelig løn',
  beregnStoreBededagstillaeg: true,
  feriePct: 12.5,
  manualRows: [row('base', '2023-01-01', 1000)],
  tafRanges: [{ fra: iso('2023-01-01'), til: iso('2024-09-30') }],
  ...overrides,
});

describe('manuelForm', () => {
  it('konsoliderer navn, rækker, Store Bededag og feriepct-gates', () => {
    expect(manuelForm.konsolider(createContext())).toEqual({
      strategi: 'manual',
      label: 'Egen løn',
      konsolideret: expect.objectContaining({
        reguleringsdato: iso('2023-01-01'),
        feriePct: 12.5,
        beregnStoreBededagstillaeg: true,
      }),
    });

    expect(() => manuelForm.konsolider({
      ...createContext([manualAf(), manualAf({ loenudviklingManuelNavn: 'Anden løn' })]),
    })).not.toThrow();
    expect(() => manuelForm.konsolider({
      ...createContext([manualAf({ beregnStoreBededagstillaeg: true }), manualAf({ beregnStoreBededagstillaeg: false })]),
    })).toThrow('Inkonsistente loenudviklingsindstillinger: Store Bededagstillæg');

    expect(() => manuelForm.konsolider({
      ...createContext(),
      kraeverFeriePctVedBeregningsperiode: true,
      active: [manualAf({ feriePct: undefined })],
    })).toThrow('feriepct mangler');
    expect(() => manuelForm.konsolider({
      ...createContext(),
      angivetLoen: false,
      activeMedSynligeSatserOgLoenoplysninger: [manualAf({ feriePct: 10 }), manualAf({ feriePct: 11 })],
    })).toThrow('Inkonsistente loenudviklingsindstillinger: feriepct');
    expect(manuelForm.konsolider({
      ...createContext(),
      kraeverFeriePctVedBeregningsperiode: false,
      active: [manualAf({ feriePct: undefined, loenudviklingManuelNavn: undefined })],
    }).konsolideret).toEqual(expect.objectContaining({ label: 'Manuelt angivet', feriePct: 0 }));
  });

  it('bygger manuelle segmenter med carry-forward og Store Bededag-breakpoint', () => {
    const result = manuelForm.byggResultat(createKonsolideret({
      feriePct: 0,
      manualRows: [
        row('base', '2023-01-01', 1000),
        row('before-base', '2022-06-01', 2000),
        row('no-date', undefined, 3000),
        row('change', '2024-01-01', 1100),
      ],
    }));

    expect(result.forloeb).toBeUndefined();
    expect(result.segmenter.length).toBe(2);
    expect(result.segmenter[0]?.deltaPct).toBe(0);
    expect(result.segmenter[1]?.fra).toBe(iso('2024-01-01'));
    expect(result.segmenter[1]?.deltaPct).toBe(10.5);
  });

  it('afviser strategi-, række-, pakke- og tomheds-gates', () => {
    expect(() => manuelForm.byggResultat({ ...createKonsolideret(), strategi: 'krl' } as never))
      .toThrow('manuel strategi mangler');
    expect(() => manuelForm.byggResultat(createKonsolideret({ manualRows: [] })))
      .toThrow('manuelle reguleringsraekker mangler');
    expect(() => manuelForm.byggResultat(createKonsolideret({
      manualRows: [row('base', '2023-01-01', 0)],
    }))).toThrow('ugyldig manuel basispakke');
    expect(() => manuelForm.byggResultat(createKonsolideret({
      manualRows: [row('base', '2023-01-01', 1000), row('bad', '2024-01-01', 0)],
    }))).toThrow('ugyldig manuel pakkevaerdi');
    expect(() => manuelForm.byggResultat(createKonsolideret({ tafRanges: [] })))
      .toThrow('ingen manuelle segmenter');
  });

  it('har ingen kildedækning for manuel regulering', () => {
    expect(manuelForm.coverageInterval(manualAf())).toBeUndefined();
  });
});
