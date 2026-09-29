import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { manuelProcentsatsForm } from '../../../domain/erstatningsopgoerelse/engines/regulering/forms/manuelProcentsatsForm';
import * as manuelProcentsatsRegulering from '../../../domain/erstatningsopgoerelse/engines/manuelProcentsatsRegulering';
import type {
  FormKonsoliderContext,
  KonsolideretLoenudvikling,
  LoenudviklingManualProcentsatsRow,
} from '../../../domain/erstatningsopgoerelse/engines/regulering/reguleringForm';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type { ISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => value as ISODateString;

const rows = (extra: ReadonlyArray<LoenudviklingManualProcentsatsRow> = []): LoenudviklingManualProcentsatsRow[] => [
  { id: 'base', dato: undefined, procent: 0 },
  ...extra,
];

const createSource = (
  manualRows: ReadonlyArray<LoenudviklingManualProcentsatsRow>
) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  loenudviklingBeregningsgrundlag: 'Manuel procentsats' as const,
  loenudviklingManuelProcentsatsTableData: [...manualRows],
});

const tafRanges = [{ fra: iso('2024-01-01'), til: iso('2026-12-31') }];

const createContext = (
  active: readonly ReturnType<typeof createSource>[],
  anvendtReguleringsdato: ISODateString | undefined = iso('2024-01-01'),
  ranges = tafRanges
): FormKonsoliderContext => ({
  active,
  angivetLoen: true,
  anvendtReguleringsdato,
  tafRanges: ranges,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  kraeverFeriePctVedBeregningsperiode: false,
  activeMedSynligeSatserOgLoenoplysninger: [],
});

type ManualProcentsatsKonsolideret = Extract<KonsolideretLoenudvikling, { strategi: 'manualProcentsats' }>;

const createKonsolideret = (
  overrides: Partial<ManualProcentsatsKonsolideret> = {}
): ManualProcentsatsKonsolideret => ({
  strategi: 'manualProcentsats',
  label: 'Manuel procentsats',
  reguleringsdato: iso('2024-01-01'),
  manualProcentsatsRows: rows([
    { id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 },
    { id: 'pct-2026', dato: iso('2026-01-01'), procent: 10 },
  ]),
  tafRanges,
  ...overrides,
});

describe('manuelProcentsatsForm', () => {
  it('konsoliderer rækker og normaliserer manglende dato/procent', () => {
    const source = createSource(rows([{ id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 }]));
    const result = manuelProcentsatsForm.konsolider(createContext([source, source]));

    expect(result).toEqual({
      strategi: 'manualProcentsats',
      label: 'Manuel procentsats',
      konsolideret: {
        strategi: 'manualProcentsats',
        label: 'Manuel procentsats',
        reguleringsdato: iso('2024-01-01'),
        manualProcentsatsRows: rows([{ id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 }]),
        tafRanges,
      },
    });

    const missingValues = createSource([{ id: 'base', dato: undefined, procent: undefined }]);
    expect(manuelProcentsatsForm.konsolider(createContext([missingValues, missingValues])).konsolideret)
      .toMatchObject({ manualProcentsatsRows: [{ id: 'base', dato: undefined, procent: undefined }] });
  });

  it('afviser uens manuelle procentsatsrækker mellem aktive ansættelser', () => {
    const first = createSource(rows([{ id: 'pct-2025', dato: iso('2025-01-01'), procent: 10 }]));
    const second = createSource(rows([{ id: 'pct-2025', dato: iso('2025-01-01'), procent: 11 }]));

    expect(() => manuelProcentsatsForm.konsolider(createContext([first, second])))
      .toThrow('Inkonsistente loenudviklingsindstillinger: manuelle procentsatsraekker');
  });

  it('bygger basis- og kædede reguleringssegmenter samt autoritativt forløb', () => {
    const result = manuelProcentsatsForm.byggResultat(createKonsolideret());

    expect(result.segmenter).toEqual([
      { fra: iso('2024-01-01'), til: iso('2024-12-31'), deltaPct: 0 },
      { fra: iso('2025-01-01'), til: iso('2025-12-31'), deltaPct: 10 },
      { fra: iso('2026-01-01'), til: iso('2026-12-31'), deltaPct: 21 },
    ]);
    expect(result.forloeb?.kind).toBe('manuelProcentsats');
    if (result.forloeb?.kind !== 'manuelProcentsats') throw new Error('Manuelt procentsats-forløb mangler');
    expect(result.forloeb.entries.map((entry) => entry.rowId)).toEqual(['base', 'pct-2025', 'pct-2026']);
    expect(result.forloeb.entries.map((entry) => entry.startIso)).toEqual([
      iso('2024-01-01'),
      iso('2025-01-01'),
      iso('2026-01-01'),
    ]);
    expect(result.forloeb.entries[0]).toMatchObject({ procent: 0, indeks: 100, akkumuleretPct: 0, isBase: true });
    expect(result.forloeb.entries[1]?.indeks).toBeCloseTo(110, 10);
    expect(result.forloeb.entries[1]?.akkumuleretPct).toBeCloseTo(10, 10);
    expect(result.forloeb.entries[2]?.indeks).toBeCloseTo(121, 10);
    expect(result.forloeb.entries[2]?.akkumuleretPct).toBeCloseTo(21, 10);
    expect(result.forloeb.entries.slice(1).every((entry) => !entry.isBase && entry.procent === 10)).toBe(true);
  });

  it('returnerer ingen kildedækning og fejler lukket ved manglende dato eller segmenter', () => {
    expect(manuelProcentsatsForm.coverageInterval(createSource(rows()))).toBeUndefined();

    expect(() => manuelProcentsatsForm.byggResultat(createKonsolideret({ reguleringsdato: undefined })))
      .toThrow('Loenudvikling kan ikke beregnes: reguleringsdato mangler');
    const entriesSpy = vi.spyOn(manuelProcentsatsRegulering, 'buildManuelProcentsatsEntries').mockReturnValue([]);
    expect(() => manuelProcentsatsForm.byggResultat(createKonsolideret()))
      .toThrow('Loenudvikling kan ikke beregnes: manuel procentsats mangler basisindeks');
    entriesSpy.mockRestore();
    expect(() => manuelProcentsatsForm.byggResultat(createKonsolideret({ tafRanges: [] })))
      .toThrow('Loenudvikling kan ikke beregnes: ingen manuel procentsats-segmenter');
  });

  it('afviser en forkert strategi før manuel procentsats behandles', () => {
    const wrongStrategy = {
      strategi: 'manual',
      label: 'Manuelt angivet',
      reguleringsdato: iso('2024-01-01'),
      loenPaaHelligdage: 'Almindelig løn',
      beregnStoreBededagstillaeg: false,
      feriePct: 0,
      manualRows: [],
      tafRanges,
    } as never;

    expect(() => manuelProcentsatsForm.byggResultat(wrongStrategy))
      .toThrow('Loenudvikling kan ikke beregnes: manuel procentsats-strategi mangler');
  });
});
