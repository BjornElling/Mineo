import {
  buildOffentligeYdelserUdviklingModel,
  resolveOffentligeYdelserAkkumuleretReguleringPct,
} from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { roundByMethod } from '../../../utils/rounding';
import { toISODateString } from '../../../types/branded';
import type { IncomePeriodResult } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';

const iso = (value: string) => toISODateString(value);

describe('buildOffentligeYdelserUdviklingModel regulering', () => {
  it('runder den akkumulerede reguleringsprocent til 2 decimaler før både beløb og visning', () => {
    // Akkumuleret regulering over et årsskifte har typisk >2 decimaler. Segmentets deltaPct (som
    // vises som faktor "+ X,XX %") skal være den 2-decimal-afrundede værdi, og beløbet skal regnes
    // med netop den — så brugeren kan efterregne beløbet fra den viste faktor (samme princip som løn).
    const income: IncomePeriodResult = {
      employers: [],
      benefits: [{ typeKey: 'dagpenge', label: 'Dagpenge', amount: 12000 }],
    };
    const model = buildOffentligeYdelserUdviklingModel({
      values: { ...createErstatningsopgoerelseInitialValues(), midlertidigtEetFraEetSiden: 'Nej' },
      incomeForBeregningsperiode: income,
      divisor: 1,
      tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
      tafRanges: [{ fra: iso('2022-01-01'), til: iso('2023-12-31') }],
      tafArbejdsdageSet: null,
      reguler: true,
      reguleringsBaseIso: iso('2022-01-01'),
    });

    expect(model).not.toBeNull();
    const segment2023 = model?.entries[0]?.beregnedeSegmenter.find((s) => s.fra.startsWith('2023'));
    expect(segment2023).toBeDefined();
    if (!segment2023) return;

    const raw = resolveOffentligeYdelserAkkumuleretReguleringPct(2023, 2022);
    const rundet = roundByMethod(raw, 2, 'halfAwayFromZero');

    // deltaPct er 2-decimal-afrundet (ikke den rå >2-decimalers akkumulerede sats).
    expect(segment2023.deltaPct).toBe(rundet);
    expect(roundByMethod(segment2023.deltaPct, 2, 'halfAwayFromZero')).toBe(segment2023.deltaPct);
    // Bekræfter at der reelt var en divergens at rette (rå ≠ afrundet).
    expect(raw).not.toBe(rundet);
  });
});
