import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import {
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const dayWithSvieSmerte: RowDay = {
  iso: iso('2024-06-15'),
  weekday: 6,
  isWeekend: true,
  isSognehelligdag: false,
  isArbejdsdag: false,
  tafFlags: new Set<string>(),
  svieSmerte: 'Fuld',
};

const valuesWithoutSelectedSatsaar: ErstatningsopgoerelseValues = {
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: iso('2024-06-01'),
  vedroererPeriodeTil: iso('2024-06-30'),
  svieSmerteSatserAar: undefined,
  svieSmerteDelvisSygemeldingSats: 'halv',
};

describe('eoInspektionLoenCoreModel – uafhængigt svie/smerte-facit', () => {
  it('udelader svie/smerte-dag når valgt satsår mangler', () => {
    const result = buildLoenTimeline({
      inspektionDays: [dayWithSvieSmerte],
      eoValues: valuesWithoutSelectedSatsaar,
      stamdataValues: STAMDATA_INITIAL_VALUES,
    });

    expect(result).toEqual({
      loenDays: [],
      svieSmerteDays: [],
    });
  });
});
