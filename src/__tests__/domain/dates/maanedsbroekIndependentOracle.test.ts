import { sumMaanedsbroekForInterval } from '../../../domain/dates/maanedsbroek';
import { toISODateString, type ISODateString } from '../../../types/branded';

type PeriodeInput = Readonly<{
  fra: ISODateString;
  til: ISODateString;
}>;

type PeriodeFacit = Readonly<{
  maanedsbroek: number;
}>;

const input: PeriodeInput = {
  fra: toISODateString('2024-01-31'),
  til: toISODateString('2024-02-01'),
};

// Den inklusive periode dækker én januardag og én februardag i et skudår:
// 1/31 + 1/29 = 60/899. Facittet bruger ingen Mineo-datoberegning.
const facit: PeriodeFacit = {
  maanedsbroek: 60 / 899,
};

describe('sumMaanedsbroekForInterval – uafhængigt skudårs-/månedsgrænsefacit', () => {
  it('fordeler hver af de to dage efter sin egen kalendermåneds længde', () => {
    expect(sumMaanedsbroekForInterval(input.fra, input.til)).toBeCloseTo(facit.maanedsbroek, 12);
  });
});
