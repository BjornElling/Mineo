import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const makeDay = (value: string, svieSmerte: RowDay['svieSmerte']): RowDay => ({
  iso: iso(value),
  weekday: 6,
  isWeekend: true,
  isSognehelligdag: false,
  isArbejdsdag: false,
  tafFlags: new Set(),
  svieSmerte,
});

describe('DATA-001/TD-020 – svie/smerte-sats som downstream-facit', () => {
  it('fører det statiske 2024-facit gennem EO-inspektionens dagsposter', () => {
    const values: ErstatningsopgoerelseValues = {
      ...createErstatningsopgoerelseInitialValues(),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'halv',
    };

    const result = buildLoenTimeline({
      inspektionDays: [
        makeDay('2024-01-06', 'Fuld'),
        makeDay('2024-01-07', 'Delvis'),
      ],
      eoValues: values,
      stamdataValues: STAMDATA_INITIAL_VALUES,
    });

    // Uafhængigt facit: 2024-satsen er 230 kr. pr. dag; delvis sygemelding er halv sats.
    expect(result.svieSmerteDays).toEqual([
      { iso: iso('2024-01-06'), niveau: 'Fuld', amount: 230 },
      { iso: iso('2024-01-07'), niveau: 'Delvis', amount: 115 },
    ]);
  });
});
