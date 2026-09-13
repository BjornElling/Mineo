import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenudviklingModel } from '../../../domain/erstatningsopgoerelse/engines/loenudviklingBeregning';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const expectedSegments = [
  { fra: '2005-04-01', til: '2005-12-31', maaneder: 9, reguleretLoenOre: 1_000_000, amountOre: 9_000_000 },
  { fra: '2006-01-01', til: '2006-09-30', maaneder: 9, reguleretLoenOre: 1_014_000, amountOre: 9_126_000 },
  { fra: '2006-10-01', til: '2007-03-31', maaneder: 6, reguleretLoenOre: 1_024_140, amountOre: 6_144_840 },
  { fra: '2007-04-01', til: '2007-09-30', maaneder: 6, reguleretLoenOre: 1_032_333, amountOre: 6_193_998 },
  { fra: '2007-10-01', til: '2008-03-31', maaneder: 6, reguleretLoenOre: 1_036_462, amountOre: 6_218_772 },
  { fra: '2008-04-01', til: '2008-09-30', maaneder: 6, reguleretLoenOre: 1_078_957, amountOre: 6_473_742 },
  { fra: '2008-10-01', til: '2009-03-31', maaneder: 6, reguleretLoenOre: 1_094_602, amountOre: 6_567_612 },
  { fra: '2009-04-01', til: '2009-09-30', maaneder: 6, reguleretLoenOre: 1_096_791, amountOre: 6_580_746 },
  { fra: '2009-10-01', til: '2010-03-31', maaneder: 6, reguleretLoenOre: 1_109_404, amountOre: 6_656_424 },
] as const;

describe('DATA-001/TD-020 – historisk KL-lønaftale-kæde som TAF-consumer', () => {
  it('fører håndberegnet 2005–2010-facit gennem den faktiske lønudviklingsmodel', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = amount(10_000);
    values.angivetMaanedsloenOpreguleresFraDato = iso('2005-04-01');
    values.tafPerioder = [{
      id: 'td020-kl-historisk',
      fra: iso('2005-04-01'),
      til: iso('2010-03-31'),
      loseFeriedage: 0,
    }];
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
    };

    const model = buildLoenudviklingModel(
      values,
      { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2005-04-01') },
      TAF_BEREGNES_SOM.MAANEDER,
      null,
      { tafRanges: [{ fra: iso('2005-04-01'), til: iso('2010-03-31') }] }
    );

    expect(model.beregnedeSegmenter.map((segment) => {
      if (segment.kind !== 'maaneder' || segment.reguleretLoenOre === undefined) {
        throw new Error('Forventede KL-lønaftaler-segmenter i månedsform');
      }
      return {
        fra: segment.fra,
        til: segment.til,
        maaneder: segment.maaneder,
        reguleretLoenOre: segment.reguleretLoenOre,
        amountOre: segment.amountOre,
      };
    })).toEqual(expectedSegments.map((segment) => ({
      ...segment,
      fra: iso(segment.fra),
      til: iso(segment.til),
    })));

    expect(model.loenudviklingTotal).toEqual({ status: 'ok', value: 62_962_134 });
  });
});
