import {
  buildOffentligeYdelserReguleringTableData,
  buildOffentligeYdelserUdviklingModel,
  resolveOffentligeYdelserAkkumuleretReguleringPct,
} from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { IncomePeriodResult } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { toISODateString, type ISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('uafhængigt sats → beregning → dokument-facit', () => {
  const values = () => ({
    ...createErstatningsopgoerelseInitialValues(),
    midlertidigtEetFraEetSiden: 'Nej' as const,
  });

  const income = (): IncomePeriodResult => ({
    employers: [],
    benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
  });

  it('fører literal-reguleringssatser gennem ydelsesberegning til dokumenttabellen', () => {
    // Uafhængigt facit: 2025-satsen er 3,9 %, 2026-satsen er 4,8 %, og
    // 1,039 · 1,048 = 1,088872 → 8,89 % efter den dokumenterede 2-decimalregel.
    const income: IncomePeriodResult = {
      employers: [],
      benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
    };
    const model = buildOffentligeYdelserUdviklingModel({
      values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Nej' },
      incomeForBeregningsperiode: income,
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2026-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2024-01-01'),
    });

    expect(model).not.toBeNull();
    if (!model) return;

    const entry = model.entries[0];
    expect(entry).toBeDefined();
    if (!entry) return;

    expect(entry.beregnedeSegmenter.map(({ fra, deltaPct }) => [fra, deltaPct])).toEqual([
      ['2024-01-01', 0],
      ['2025-01-01', 3.9],
      ['2026-01-01', 8.89],
    ]);

    const documentTable = buildOffentligeYdelserReguleringTableData(model);
    expect(documentTable).toEqual({
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [
        ['01-01-2025', '3,9 %', '3,9 %'],
        ['01-01-2026', '4,8 %', '8,89 %'],
      ],
    });
  });

  it('dækker tom ydelsesliste og fail-closed inputgates', () => {
    const base = {
      values: values(),
      incomeForBeregningsperiode: income(),
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2024-01-01'),
    };

    expect(buildOffentligeYdelserUdviklingModel({
      ...base,
      incomeForBeregningsperiode: { employers: [], benefits: [] },
    })).toBeNull();
    expect(() => buildOffentligeYdelserUdviklingModel({ ...base, divisor: 0 }))
      .toThrow('mangler beregningsgrundlag');
    expect(() => buildOffentligeYdelserUdviklingModel({ ...base, tafRanges: [] }))
      .toThrow('TAF-perioder mangler');
    expect(() => buildOffentligeYdelserUdviklingModel({ ...base, reguleringsBaseIso: undefined }))
      .toThrow('reguleringsdato mangler');
    expect(() => buildOffentligeYdelserUdviklingModel({
      ...base,
      reguleringsBaseIso: 'ikke-en-dato' as unknown as ISODateString,
    })).toThrow('ugyldig reguleringsdato');
  });

  it('bygger uregulerede arbejdsdagssegmenter med det faktiske arbejdsdagsgrundlag', () => {
    const model = buildOffentligeYdelserUdviklingModel({
      values: values(),
      incomeForBeregningsperiode: income(),
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-02') }],
      tafArbejdsdageSet: new Set([iso('2024-01-01')]),
      reguler: false,
      reguleringsBaseIso: undefined,
    });

    expect(model?.reguleringsLabel).toBe('Ingen');
    expect(model?.entries[0]?.beregnedeSegmenter).toEqual([
      expect.objectContaining({
        kind: 'arbejdsdage',
        fra: iso('2024-01-01'),
        til: iso('2024-01-02'),
        arbejdsdage: 1,
        deltaPct: 0,
      }),
    ]);
    expect(buildOffentligeYdelserReguleringTableData(model!)).toBeNull();
  });

  it('springer tomme arbejdsdagssegmenter over og kræver arbejdsdagegrundlag', () => {
    const base = {
      values: values(),
      incomeForBeregningsperiode: income(),
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-01-02') }],
      reguler: false,
      reguleringsBaseIso: undefined,
    };

    const noWorkdays = buildOffentligeYdelserUdviklingModel({
      ...base,
      tafArbejdsdageSet: new Set(),
    });
    expect(noWorkdays?.entries[0]?.beregnedeSegmenter).toEqual([]);
    expect(buildOffentligeYdelserReguleringTableData(noWorkdays!)).toBeNull();
    expect(() => buildOffentligeYdelserUdviklingModel({
      ...base,
      tafArbejdsdageSet: null,
    })).toThrow('arbejdsdagegrundlag mangler');
  });

  it('viser en tom tabel når reguleringsvinduet ikke går ud over basisåret', () => {
    const model = buildOffentligeYdelserUdviklingModel({
      values: values(),
      incomeForBeregningsperiode: income(),
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2024-01-01'), til: iso('2024-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2024-01-01'),
    });

    expect(buildOffentligeYdelserReguleringTableData(model!)).toEqual({
      columns: ['Reguleringsdato', 'Regulering', 'Akkumuleret regulering'],
      rows: [],
    });
  });

  it('fail-closer ved manglende reguleringssats både i motor og dokumenttabel', () => {
    expect(() => resolveOffentligeYdelserAkkumuleretReguleringPct(2027, 2026))
      .toThrow('reguleringssats mangler for 2027');

    const baseModel = buildOffentligeYdelserUdviklingModel({
      values: values(),
      incomeForBeregningsperiode: income(),
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2026-01-01'), til: iso('2026-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2026-01-01'),
    });
    expect(baseModel).not.toBeNull();
    if (!baseModel) return;

    const entry = baseModel.entries[0];
    const segment = entry?.beregnedeSegmenter[0];
    expect(segment).toBeDefined();
    if (!segment) return;

    const modelWithMissingRate = {
      ...baseModel,
      entries: [{
        ...entry,
        beregnedeSegmenter: [{ ...segment, til: iso('2027-01-01') }],
      }],
    };
    expect(() => buildOffentligeYdelserReguleringTableData(modelWithMissingRate))
      .toThrow('reguleringssats mangler for 2027');
  });
});
