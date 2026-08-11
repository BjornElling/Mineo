import {
  integerStringBoundsValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from '../../../inputCore/catalog/boundsValidators';
import type { CanonicalView, FieldRef } from '../../../inputCore/fieldDescriptor';

const stringField = { descriptor: { id: 'test.string' } } as unknown as FieldRef<string | undefined>;
const view = { readCanonical: () => undefined } as unknown as CanonicalView;

describe('string-backed bounds-validatorer', () => {
  it('fortolker ikke et ugyldigt heltalspræfiks som et tal', () => {
    const validate = integerStringBoundsValidator('test.integer.bounds', 1, 10);

    expect(validate('12x', stringField, view)).toBeUndefined();
    expect(validate('0', stringField, view)).toMatchObject({ reason: 'bounds', code: 'test.integer.bounds' });
    expect(validate('10', stringField, view)).toBeUndefined();
  });

  it('kræver præcis fire cifre i string-backed årstal', () => {
    const validate = yearStringBoundsValidator('test.year.bounds', 2000, 2030);

    expect(validate('2031x', stringField, view)).toBeUndefined();
    expect(validate('1999', stringField, view)).toMatchObject({ reason: 'bounds', code: 'test.year.bounds' });
    expect(validate('2030', stringField, view)).toBeUndefined();
  });

  it('læser kun årskomponenten i ugefeltet og afviser ikke codecens format i bounds-laget', () => {
    const validate = weekYearBoundsValidator('test.week.bounds', 2000, 2030);

    expect(validate('01/2031', stringField, view)).toMatchObject({ reason: 'bounds' });
    expect(validate('01/2031x', stringField, view)).toBeUndefined();
    expect(validate('99/2030', stringField, view)).toBeUndefined();
  });
});
