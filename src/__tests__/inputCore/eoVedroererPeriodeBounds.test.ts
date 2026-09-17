import {
  eoVedroererPeriodeFraField,
  eoVedroererPeriodeTilField,
} from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadestypeField,
} from '../../inputCore/catalog/stamdataDescriptors';
import { toISODateString, type ISODateString } from '../../types/branded';
import type { CanonicalView, FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';

/**
 * «Vedrører perioden» var fladens ENESTE dato uden bund i sagens egen skadedato.
 *
 * En dato otte år før skaden blev afsluttet canonical med neutral kant og uden besked, mens fladens øvrige
 * otte datoer alle havde skadedatoen som gulv og sagde det. Perioden afgrænser samtlige krav, dokumentets
 * overskriftslinje og sammentællingens «Det samlede krav for perioden …», så et forkert årstal – den
 * hyppigste datofejl – gik uhindret igennem. Felterne bruger nu samme spec som resten af fladen, hvilket
 * også giver dem erhvervssygdoms-reglen (anmeldelsesdato minus 5 år) uden en parallel implementering.
 */

const SKADEDATO = '2018-06-01';

const viewWith = (skadestype: string): CanonicalView => ({
  readCanonical: <T,>(field: FieldRef<T>): T | undefined => {
    if (field.descriptor.id === stamdataSkadedatoField.id) return toISODateString(SKADEDATO) as T;
    if (field.descriptor.id === stamdataSkadestypeField.id) return skadestype as T;
    return undefined;
  },
} as unknown as CanonicalView);

const issueFor = (
  descriptor: FieldDescriptor<ISODateString | undefined>,
  value: string,
  skadestype = 'Arbejdsulykke'
) => {
  const bound = descriptor.bind();
  const view = viewWith(skadestype);
  for (const validator of descriptor.validators ?? []) {
    const issue = validator(toISODateString(value), bound, view);
    if (issue !== undefined) return issue;
  }
  return undefined;
};

describe('«Vedrører perioden» har skadedatoen som gulv', () => {
  it.each([
    ['fra-datoen', eoVedroererPeriodeFraField],
    ['til-datoen', eoVedroererPeriodeTilField],
  ])('afviser %s før skadedatoen og navngiver skadedatoen som grænsen', (_navn, descriptor) => {
    const issue = issueFor(descriptor, '2010-01-01');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('skadedatoen');
    expect(issue?.message).toContain('01-06-2018');
  });

  it('accepterer en periode, der begynder præcis på skadedatoen', () => {
    expect(issueFor(eoVedroererPeriodeFraField, SKADEDATO)).toBeUndefined();
  });

  it('accepterer en periode efter skadedatoen', () => {
    expect(issueFor(eoVedroererPeriodeFraField, '2018-07-01')).toBeUndefined();
  });

  /**
   * Erhvervssygdom følger sin egen nedre regel: datoen må ligge før anmeldelsesdatoen, blot ikke mere end
   * fem år før. Reglen kommer fra den delte spec og er ikke skrevet på ny her – prøven bekræfter, at
   * periodefelterne faktisk arver den i stedet for at bruge skadedatoen som et hårdt gulv.
   */
  it('lader en erhvervssygdomssag række tilbage før anmeldelsesdatoen', () => {
    expect(issueFor(eoVedroererPeriodeFraField, '2015-01-01', 'Erhvervssygdom')).toBeUndefined();
  });

  it('afviser en erhvervssygdomssag mere end fem år før anmeldelsesdatoen', () => {
    const issue = issueFor(eoVedroererPeriodeFraField, '2010-01-01', 'Erhvervssygdom');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('5 år');
  });
});
