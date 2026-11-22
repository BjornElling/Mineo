import {
  amountBoundsValidator,
  integerStringBoundsValidator,
  positiveAmountBoundsValidator,
  weekYearBoundsValidator,
  yearStringBoundsValidator,
} from '../../../inputCore/catalog/boundsValidators';
import type { CanonicalView, FieldRef } from '../../../inputCore/fieldDescriptor';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { productionInputFields } from '../../../inputCore/catalog/productionCatalog';
import { eoOevrigeKravBeloebField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { rentekravBelobField } from '../../../inputCore/catalog/renteberegningDescriptors';
import { buildFieldIssueSet, toAnyFieldRef, serializeFieldAddress } from '../../../inputCore';

const stringField = { descriptor: { id: 'test.string' } } as unknown as FieldRef<string | undefined>;
const amountField = { descriptor: { id: 'test.amount' } } as unknown as FieldRef<AmountValue | undefined>;
const view = { readCanonical: () => undefined } as unknown as CanonicalView;
const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('amountBoundsValidator – eksklusiv nedre grænse (NY-12c-4)', () => {
  it('et felt, der accepterer 0, beholder «0 kr. eller højere»', () => {
    const validate = amountBoundsValidator('test.amount.bounds', 0, undefined);
    expect(validate(amount(0), amountField, view)).toBeUndefined();
    expect(validate(amount(-100), amountField, view)).toMatchObject({
      reason: 'bounds',
      message: 'Værdi skal være 0 kr. eller højere',
    });
  });

  it('et strengt positivt felt giver «større end 0 kr.» for BÅDE nul og negativt', () => {
    const validate = positiveAmountBoundsValidator('test.amount.bounds');
    expect(validate(amount(0), amountField, view)).toMatchObject({
      reason: 'bounds',
      message: 'Beløbet skal være større end 0 kr.',
    });
    expect(validate(amount(-100), amountField, view)).toMatchObject({
      reason: 'bounds',
      message: 'Beløbet skal være større end 0 kr.',
    });
    expect(validate(amount(0.01), amountField, view)).toBeUndefined();
    expect(validate(undefined, amountField, view)).toBeUndefined();
  });

  it('subjektet følger feltet', () => {
    expect(positiveAmountBoundsValidator('test.amount.bounds', 'Månedslønnen')(amount(-1), amountField, view))
      .toMatchObject({ message: 'Månedslønnen skal være større end 0 kr.' });
  });

  /**
   * Feltniveauet: hvad brugeren faktisk ser er det ENE aktive issue efter §1.8's prioritet. Før rettelsen
   * havde felterne både en inklusiv grænse på 0 og en «> 0»-regel; ved -100 vandt bounds-beskeden.
   */
  it.each([
    ['Øvrige erstatningskrav → Beløb', eoOevrigeKravBeloebField],
    ['Renteberegning → Beløb', rentekravBelobField],
  ] as const)('%s viser «større end 0 kr.» ved -100 og ved 0', (_name, descriptor) => {
    const field = descriptor.bind('row-1');
    const activeMessage = (value: number): string | undefined => {
      const candidates = (field.descriptor.validators ?? []).flatMap((validate) => {
        const spec = validate(amount(value), field, view);
        return spec === undefined ? [] : [{
          kind: 'field' as const,
          code: spec.code,
          severity: 'error' as const,
          field: toAnyFieldRef(field),
          reason: spec.reason,
          message: spec.message,
        }];
      });
      return buildFieldIssueSet(candidates).get(serializeFieldAddress(field.address))?.message;
    };
    expect(activeMessage(-100)).toBe('Beløbet skal være større end 0 kr.');
    expect(activeMessage(0)).toBe('Beløbet skal være større end 0 kr.');
    expect(activeMessage(1)).toBeUndefined();
  });

  it('intet produktionsbeløbsfelt kan vise «0 kr. eller højere» for en værdi, det også afviser ved 0', () => {
    // Værnet mod at genindføre to overlappende erklæringer: et felt, der afviser 0, må ikke have en
    // aktiv besked, der påstår, at 0 er tilladt.
    const offenders = productionInputFields
      .filter((descriptor) => descriptor.codec.family === 'amount')
      .filter((descriptor) => {
        const entityIds = descriptor.template.path.filter((segment) => segment.kind === 'entity').map(() => 'row-1');
        const field = descriptor.bind(...entityIds);
        const listingView = { readCanonical: () => undefined, listEntityIds: () => [] } as unknown as CanonicalView;
        const validators = descriptor.validators ?? [];
        const rejectsZero = validators.some((validate) => validate(amount(0), field, listingView) !== undefined);
        if (!rejectsZero) return false;
        return validators.some(
          (validate) => validate(amount(-100), field, listingView)?.message.includes('eller højere') === true
        );
      })
      .map((descriptor) => descriptor.id);
    expect(offenders).toEqual([]);
  });
});

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
