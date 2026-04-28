import { erstatningsopgoerelseSchema } from '../../schemas/formSchemas';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { getEoBilagAvailability } from '../../domain/erstatningsopgoerelse/helpers/eoBilagRules';

describe('erstatningsopgoerelse midlertidigt EET migration', () => {
  it('loader pre-1.0.7 data uden toggle-felt som frakoblet og bevarer manuelle midlertidigt EET-rækker', () => {
    const legacyValues = {
      ...createErstatningsopgoerelseInitialValues(),
      offentligeYdelserRows: [{
        id: 'legacy-midlertidigt-eet',
        fraDato: '01-01-2024',
        tilDato: '31-01-2024',
        ydelse: { kind: 'number', value: 1000 },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      }],
      eoBilagSelection: {
        ...createErstatningsopgoerelseInitialValues().eoBilagSelection,
        midlertidigEet: true,
      },
    };
    delete (legacyValues as Partial<typeof legacyValues>).midlertidigtEetFraEetSiden;

    const parsed = erstatningsopgoerelseSchema.parse(legacyValues);
    const availability = getEoBilagAvailability({ eoValues: parsed });
    const runtimeSelectedMidlertidigEet = availability.midlertidigEet.enabled
      ? parsed.eoBilagSelection.midlertidigEet
      : false;

    expect(parsed.midlertidigtEetFraEetSiden).toBe('Nej');
    expect(parsed.offentligeYdelserRows).toEqual(legacyValues.offentligeYdelserRows);
    expect(availability.midlertidigEet.enabled).toBe(false);
    expect(runtimeSelectedMidlertidigEet).toBe(false);
  });
});
