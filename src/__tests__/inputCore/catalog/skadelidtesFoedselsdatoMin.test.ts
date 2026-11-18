import { dateBoundsValidator, systemrammeSpec } from '../../../inputCore/catalog/dateBoundsValidators';
import {
  stamdataSkadelidteFodselsdatoField,
  withSkadelidtesFoedselsdatoMin,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { eoTafBeregningsperiodeFraField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { aarsloenTableCol0DagField } from '../../../inputCore/catalog/aarsloenDescriptors';
import { toISODateString, type ISODateString } from '../../../types/branded';
import type { CanonicalView, FieldRef } from '../../../inputCore/fieldDescriptor';
import { isUnconstrainedDateBounds } from '../../../inputCore/dateBoundsDeclaration';

const field = { descriptor: { id: 'test.dato' } } as unknown as FieldRef<ISODateString | undefined>;

const viewWithFoedselsdato = (foedselsdato: string | undefined): CanonicalView => ({
  readCanonical: (ref: FieldRef<unknown>) =>
    ref.descriptor.id === stamdataSkadelidteFodselsdatoField.id && foedselsdato !== undefined
      ? toISODateString(foedselsdato)
      : undefined,
}) as unknown as CanonicalView;

const validate = (value: string, foedselsdato: string | undefined) =>
  dateBoundsValidator(withSkadelidtesFoedselsdatoMin(systemrammeSpec))(
    toISODateString(value), field, viewWithFoedselsdato(foedselsdato),
  );

/**
 * En indkomstperiode, der starter før skadelidtes fødsel, delte indkomsten over langt flere måneder end
 * skadelidte kunne have arbejdet, og førlønnen faldt stiltiende (udviklerens afgørelse 2026-11-18).
 */
describe('withSkadelidtesFoedselsdatoMin', () => {
  it('afviser en dato før skadelidtes fødsel og navngiver fødselsdatoen', () => {
    const issue = validate('2007-03-01', '2008-06-01');
    expect(issue?.message).toBe('Datoen kan ikke være før skadelidtes fødselsdato (01-06-2008)');
    expect(issue?.detail).toMatchObject({ minDate: '2008-06-01' });
  });

  it('tillader selve fødselsdagen', () => {
    expect(validate('2008-06-01', '2008-06-01')).toBeUndefined();
  });

  it('lader systemrammen tale, når fødselsdatoen ligger før den', () => {
    const issue = validate('2004-12-31', '1980-01-01');
    expect(issue).toBeDefined();
    expect(issue?.message).not.toContain('fødselsdato');
  });

  it('åbner ikke rammen uden fødselsdato', () => {
    expect(validate('2007-03-01', undefined)).toBeUndefined();
    expect(validate('2004-12-31', undefined)).toBeDefined();
  });

  it.each([
    ['EO-beregningsperiodens fra-dato', eoTafBeregningsperiodeFraField.dateBounds],
    ['Årslønstabellens fra-dato', aarsloenTableCol0DagField.dateBounds],
  ])('er erklæret på %s', (_name, declaration) => {
    if (declaration === undefined || isUnconstrainedDateBounds(declaration)) throw new Error('mangler grænser');
    const issue = dateBoundsValidator(declaration)(
      toISODateString('2007-03-01'), field, viewWithFoedselsdato('2008-06-01'),
    );
    expect(issue?.message).toBe('Datoen kan ikke være før skadelidtes fødselsdato (01-06-2008)');
  });
});
