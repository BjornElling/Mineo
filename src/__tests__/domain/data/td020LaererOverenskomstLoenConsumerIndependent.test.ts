import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';

const testDate = toISODateString('2024-03-04');

const makeRowDay = (): RowDay => ({
  iso: testDate,
  weekday: 1,
  isWeekend: false,
  isSognehelligdag: false,
  isArbejdsdag: true,
  tafFlags: new Set(),
  svieSmerte: 'Ingen',
});

const makeValues = (): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: toISODateString('2024-01-01'),
  vedroererPeriodeTil: toISODateString('2024-12-31'),
  loenindkomstAnsaettelsesforhold: [
    {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: 'td020-laerer-overenskomst',
      navnPaaArbejdssted: 'Testskole',
      overenskomstId: 'laerer-overenskomsten',
      feriePct: 12.5,
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
      offentligLoenType: 'Timeløn',
      offentligLoenTrin: 20,
      offentligLoenGruppe: 0,
    },
  ],
});

describe('DATA-001/TD-020 – Læreroverenskomstens offentlige tillæg i lønconsumer', () => {
  it('bruger Læreroverenskomstens offentlige fritvalg og pension i lønkomponenterne', () => {
    const result = buildLoenTimeline({
      inspektionDays: [makeRowDay()],
      eoValues: makeValues(),
      stamdataValues: STAMDATA_INITIAL_VALUES,
    });

    const day = result.loenDays[0];
    expect(day?.iso).toBe(testDate);
    expect(day?.components.map(({ type, source }) => ({ type, source }))).toEqual([
      { type: 'grundloen', source: 'overenskomst' },
      { type: 'feriegodtgorelse', source: 'manuel' },
      { type: 'fritvalg', source: 'overenskomst' },
      { type: 'storeBededag', source: 'regel' },
      { type: 'pension', source: 'overenskomst' },
    ]);

    // Uafhængigt håndfacit for 04-03-2024: grundløn 158,18, fritvalg 1,38 %, pension 17,3 %.
    expect(day?.components[0]?.amount).toBe(158.18);
    expect(day?.components[1]?.amount).toBeCloseTo(19.7725, 12);
    expect(day?.components[2]?.amount).toBeCloseTo(2.182884, 12);
    expect(day?.components[3]?.amount).toBeCloseTo(0.71181, 12);
    expect(day?.components[4]?.amount).toBeCloseTo(31.286564562, 12);
    expect(day?.dailyTotal).toBeCloseTo(212.133758562, 12);
  });
});
