import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildIncomeCalculationContext, buildIncomeForRanges } from '../../../domain/erstatningsopgoerelse/helpers/indtaegtPerioder';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = (value: string) => toISODateString(value);

describe('buildIncomeForRanges fail-closed', () => {
  it('kaster ikke fejl for rækker med data i inaktiv lønperiodekolonne', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'uge';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-inaktiv-periode-data',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '01-01-2024',
        col1_dag: '31-01-2024',
        col2: undefined,
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] as const;
    expect(() => buildIncomeForRanges(values, ranges)).not.toThrow();
    const income = buildIncomeForRanges(values, ranges);
    expect(income.employers).toHaveLength(0);
  });

  it('medregner ikke dag-rækker med fra-dato efter til-dato', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'dag';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-fejl-omvendt-dato',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '31-01-2024',
        col1_dag: '01-01-2024',
        col2: asAmount(1000),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] as const;
    expect(() => buildIncomeForRanges(values, ranges)).not.toThrow();
    const income = buildIncomeForRanges(values, ranges);
    expect(income.employers).toHaveLength(0);
  });

  it('medregner kun løn-/ydelsesrækker med gyldig fra/til og uden fejl', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'dag';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-ok',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '01-01-2024',
        col1_dag: '31-01-2024',
        col2: asAmount(100),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
      {
        id: 'loen-fejl-mangler-til',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '01-01-2024',
        col1_dag: '',
        col2: asAmount(500),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    values.offentligeYdelserRows = [
      {
        id: 'ydelse-ok',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: asAmount(200),
        tillaeg: undefined,
        ydelsestype: 'sygedagpenge',
      },
      {
        id: 'ydelse-fejl-mangler-type',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: asAmount(400),
        tillaeg: undefined,
        ydelsestype: '',
      },
    ];

    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] as const;
    const income = buildIncomeForRanges(values, ranges);

    expect(income.employers).toHaveLength(1);
    expect(income.employers[0]?.amount).toBe(100);

    expect(income.benefits).toHaveLength(1);
    expect(income.benefits[0]?.amount).toBe(200);
    expect(income.benefits[0]?.typeKey).toBe('sygedagpenge');
  });

  it('dobbelttæller ikke ved overlappende input-ranges', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'dag';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-overlap',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '01-01-2024',
        col1_dag: '31-01-2024',
        col2: asAmount(310),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const income = buildIncomeForRanges(values, [
      { fra: iso('2024-01-01'), til: iso('2024-01-15') },
      { fra: iso('2024-01-10'), til: iso('2024-01-20') },
    ]);

    // 310 over 31 dage => 10 pr dag, samlet overlap 20 dage (1-20) => 200
    expect(income.employers[0]?.amount).toBe(200);
  });

  it('medregner ikke ikke-finite afledte lønbeløb', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'dag';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'loen-nan',
        col0_maaned: '',
        col1_maaned: '',
        col0_uge: '',
        col1_uge: '',
        col0_dag: '01-01-2024',
        col1_dag: '31-01-2024',
        col2: asAmount(Number.POSITIVE_INFINITY),
        col3: undefined,
        col4: undefined,
        col5: undefined,
      },
    ];

    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(income.employers).toHaveLength(0);
  });

  it('ekskluderer rækker uden ydelsestype (fail-closed)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.offentligeYdelserRows = [
      {
        id: 'oy-u1',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: asAmount(100),
        tillaeg: undefined,
        ydelsestype: '',
      },
      {
        id: 'oy-u2',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: asAmount(200),
        tillaeg: undefined,
        ydelsestype: '',
      },
    ];

    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(income.benefits).toHaveLength(0);
  });

  it('kaster ikke fejl for offentlig ydelse med ufuldstaendig periode (fail-closed)', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.offentligeYdelserRows = [
      {
        id: 'oy-missing-til',
        fraDato: '01-01-2024',
        tilDato: '',
        ydelse: asAmount(100),
        tillaeg: undefined,
        ydelsestype: 'sygedagpenge',
      },
    ];

    const ranges = [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }] as const;
    expect(() => buildIncomeForRanges(values, ranges)).not.toThrow();
    const income = buildIncomeForRanges(values, ranges);
    expect(income.benefits).toHaveLength(0);
  });

  it('resolver ydelsestype case-insensitivt ud fra label', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.offentligeYdelserRows = [
      {
        id: 'oy-label',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: asAmount(100),
        tillaeg: undefined,
        ydelsestype: 'sYgEdAgPeNgE',
      },
    ];

    const income = buildIncomeForRanges(values, [{ fra: iso('2024-01-01'), til: iso('2024-01-31') }]);
    expect(income.benefits).toHaveLength(1);
    expect(income.benefits[0]?.typeKey).toBe('sygedagpenge');
    expect(income.benefits[0]?.label).toBe('Sygedagpenge');
  });

  it('bevarer sygedagpenge-total ved årssplit uden lønintervaller', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [];
    values.offentligeYdelserRows = [
      {
        id: 'oy-cross-year',
        fraDato: '23-12-2024',
        tilDato: '10-01-2025',
        ydelse: asAmount(11210),
        tillaeg: asAmount(248),
        ydelsestype: 'Sygedagpenge',
      },
    ];

    const fullRange = [{ fra: iso('2024-12-23'), til: iso('2025-01-10') }] as const;
    const context = buildIncomeCalculationContext(values, fullRange);
    const fullRangeIncome = buildIncomeForRanges(values, fullRange, context);
    const year2024Income = buildIncomeForRanges(values, [{ fra: iso('2024-12-23'), til: iso('2024-12-31') }], context);
    const year2025Income = buildIncomeForRanges(values, [{ fra: iso('2025-01-01'), til: iso('2025-01-10') }], context);

    const fullAmount = fullRangeIncome.benefits[0]?.amount ?? 0;
    const splitAmount = (year2024Income.benefits[0]?.amount ?? 0) + (year2025Income.benefits[0]?.amount ?? 0);

    expect(fullAmount).toBeGreaterThan(0);
    expect(Math.abs(splitAmount - fullAmount)).toBeLessThan(1e-9);
  });
});
