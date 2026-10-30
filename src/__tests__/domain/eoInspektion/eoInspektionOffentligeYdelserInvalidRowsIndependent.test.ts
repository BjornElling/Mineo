import { buildOffentligeYdelserColumns } from '../../../domain/eoInspektion/eoInspektionOffentligeYdelserColumns';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { SYGEDAGPENGE_SH_CUTOFF } from '../../../domain/erstatningsopgoerelse/engines/periodiseringsMotor';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

const iso = (value: string): ISODateString => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const dates = [
  iso('2024-01-08'),
  iso('2024-01-09'),
  iso('2024-01-10'),
  iso('2024-01-11'),
  iso('2024-01-12'),
];

const valuesWithRows = (rows: readonly OffentligeYdelserRow[]): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  offentligeYdelserRows: [...rows],
});

describe('CALC-006 – uafhængigt facit for ugyldige offentlige ydelsesrækker', () => {
  // De tidligere urenderede tekst-issues om rækkerne er fjernet (12m, udviklerafgørelse 2026-10-30): kontrolfanen
  // er passiv. Facit er nu alene, at ingen af rækkerne giver en kolonne.
  it('giver ingen kolonne for rækker uden type, med ukendt type eller med ugyldigt interval', () => {
    const rows: OffentligeYdelserRow[] = [
      {
        id: 'blank-type-med-beloeb',
        fraDato: dates[0],
        tilDato: dates[4],
        ydelsestype: '',
        ydelse: amount(100),
        tillaeg: undefined,
      },
      {
        id: 'blank-type-tom',
        fraDato: dates[0],
        tilDato: dates[4],
        ydelsestype: '',
        ydelse: amount(0),
        tillaeg: amount(0),
      },
      {
        id: 'ukendt-type-med-beloeb',
        fraDato: dates[0],
        tilDato: dates[4],
        ydelsestype: 'ukendt-ydelse',
        ydelse: amount(200),
        tillaeg: undefined,
      },
      {
        id: 'ukendt-type-tom',
        fraDato: dates[0],
        tilDato: dates[4],
        ydelsestype: 'ukendt-ydelse',
        ydelse: amount(0),
        tillaeg: amount(0),
      },
      {
        id: 'ugyldigt-interval-med-beloeb',
        fraDato: dates[4],
        tilDato: dates[0],
        ydelsestype: 'sygedagpenge',
        ydelse: amount(300),
        tillaeg: undefined,
      },
      {
        id: 'ugyldigt-interval-tom',
        fraDato: dates[4],
        tilDato: dates[0],
        ydelsestype: 'sygedagpenge',
        ydelse: amount(0),
        tillaeg: amount(0),
      },
    ];
    const result = buildOffentligeYdelserColumns({
      dates,
      isoIndex: new Map(dates.map((date, index) => [date, index])),
      values: valuesWithRows(rows),
      shDays: new Set<ISODateString>(),
      sygedagpengeShCutoff: SYGEDAGPENGE_SH_CUTOFF,
      errorRowIds: new Set<string>(),
    });

    expect(result.columns).toEqual([]);
  });
});
