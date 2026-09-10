import {
  buildOffentligeYdelserReguleringTableData,
  buildOffentligeYdelserUdviklingModel,
} from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { IncomePeriodResult } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('uafhængigt sats → beregning → dokument-facit', () => {
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
});
