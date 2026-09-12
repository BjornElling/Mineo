import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

const makeArbejdsdag = (value: string): RowDay => ({
  iso: iso(value),
  weekday: 2,
  isWeekend: false,
  isSognehelligdag: false,
  isArbejdsdag: true,
  tafFlags: new Set(),
  svieSmerte: 'Ingen',
});

const buildValues = (): ErstatningsopgoerelseValues => {
  const values = createErstatningsopgoerelseInitialValues();
  values.vedroererPeriodeFra = iso('2024-01-01');
  values.vedroererPeriodeTil = iso('2024-12-31');
  values.loenindkomstAnsaettelsesforhold = [{
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    id: 'td020-rltn-loen-core',
    harOverenskomst: true,
    overenskomstId: 'rltn-overenskomst',
    feriePct: 12.5,
    fritvalgPct: undefined,
    shSoPct: undefined,
    pensionPct: undefined,
    loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.INGEN,
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: 10,
    offentligLoenGruppe: 2,
  }];
  return values;
};

describe('DATA-001/TD-020 – RLTN som EO-inspektion-consumer', () => {
  it('fører RLTN månedsløn trin 10, gruppe 2 gennem komponentfacit', () => {
    const result = buildLoenTimeline({
      inspektionDays: [makeArbejdsdag('2024-04-02')],
      eoValues: buildValues(),
      stamdataValues: STAMDATA_INITIAL_VALUES,
    });

    // Statisk håndfacit: 22.396,67 kr. grundløn + 12,5 % feriepenge = 25.196,25375 kr.
    expect(result.loenDays).toHaveLength(1);
    expect(result.loenDays[0]?.iso).toBe(iso('2024-04-02'));
    expect(result.loenDays[0]?.components).toEqual([
      { type: 'grundloen', amount: 22396.67, source: 'overenskomst' },
      { type: 'feriegodtgorelse', amount: 2799.58375, source: 'manuel' },
    ]);
    expect(result.loenDays[0]?.dailyTotal).toBeCloseTo(25196.25375, 10);
    expect(result.svieSmerteDays).toEqual([]);
  });
});
