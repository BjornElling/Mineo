import { dateBoundsValidator } from '../../inputCore/catalog/dateBoundsValidators';
import { STATIC_DATE_BOUNDS } from '../../utils/dateRangeErrorMessages';
import { toISODateString, type ISODateString } from '../../types/branded';
import type { CanonicalView, FieldRef } from '../../inputCore/fieldDescriptor';
import type { DateBoundsSpec } from '../../inputCore/dateBoundsDeclaration';

const field = {
  descriptor: { id: 'test.dato' },
} as unknown as FieldRef<ISODateString | undefined>;

const view = {
  readCanonical: () => undefined,
} as unknown as CanonicalView;

const validateWith = (spec: DateBoundsSpec, value: string) =>
  dateBoundsValidator(spec)(toISODateString(value), field, view);

describe('dateBoundsValidator', () => {
  it('kombinerer ydre og indsnævrende grænser uden at kunne udvide intervallet', () => {
    const spec: DateBoundsSpec = {
      min: () => toISODateString('2005-01-01'),
      max: () => toISODateString('2030-12-31'),
      narrowMin: () => toISODateString('2010-01-01'),
      narrowMax: () => toISODateString('2020-12-31'),
      origin: STATIC_DATE_BOUNDS,
    };

    expect(validateWith(spec, '2009-12-31')?.detail).toMatchObject({ minDate: '2010-01-01', maxDate: '2020-12-31' });
    expect(validateWith(spec, '2021-01-01')?.detail).toMatchObject({ minDate: '2010-01-01', maxDate: '2020-12-31' });

    const cannotWidenSpec: DateBoundsSpec = {
      min: () => toISODateString('2005-01-01'),
      max: () => toISODateString('2030-12-31'),
      narrowMin: () => toISODateString('2000-01-01'),
      narrowMax: () => toISODateString('2040-12-31'),
      origin: STATIC_DATE_BOUNDS,
    };

    expect(validateWith(cannotWidenSpec, '2004-12-31')?.detail).toMatchObject({ minDate: '2005-01-01', maxDate: '2030-12-31' });
    expect(validateWith(cannotWidenSpec, '2031-01-01')?.detail).toMatchObject({ minDate: '2005-01-01', maxDate: '2030-12-31' });
  });

  it('læser dynamiske grænser ved hver validering', () => {
    let maxDate = toISODateString('2026-12-31');
    const spec: DateBoundsSpec = {
      min: () => toISODateString('2005-01-01'),
      max: () => maxDate,
      origin: STATIC_DATE_BOUNDS,
    };
    const validator = dateBoundsValidator(spec);

    expect(validator(toISODateString('2027-01-01'), field, view)?.detail).toMatchObject({ maxDate: '2026-12-31' });

    maxDate = toISODateString('2027-12-31');
    expect(validator(toISODateString('2027-01-01'), field, view)).toBeUndefined();
  });

  it('bevarer den strukturerede oprindelse i issue-detail frem for at kræve tekstfortolkning', () => {
    const spec: DateBoundsSpec = {
      min: () => toISODateString('2010-01-01'),
      max: () => toISODateString('2030-12-31'),
      origin: STATIC_DATE_BOUNDS,
      special: () => ({
        minBoundKind: 'fodselsdato',
        minBoundReferenceISO: toISODateString('2015-01-01'),
      }),
    };

    expect(validateWith(spec, '2009-12-31')?.detail).toMatchObject({
      minBoundKind: 'fodselsdato',
      minBoundReferenceISO: '2015-01-01',
    });
  });
});
