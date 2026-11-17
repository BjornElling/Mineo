import { productionInputFields } from '../../inputCore/catalog/productionCatalog';
import type { CanonicalView, FieldDescriptor, FieldRef } from '../../inputCore/fieldDescriptor';

// VÆRN (adfærd): ingen datogrænse i produktionskataloget kalder anmeldelsesdatoen for «skadedato».
//
// En grænses fejlbesked navngiver sagens dato gennem `withStamdataDatoReference`. Et datofelt, hvis
// `special` glemte indpakningen, faldt tavst tilbage til skadedato-formen – også ved en erhvervssygdom, hvor
// feltet ovenover hedder «Anmeldelsesdato». Det skete for beregningsdatoen på Erhvervsevnetab og
// Forsørgertab. Værnet kalder derfor HVERT datofelts egne validatorer i en erhvervssygdomssag med en dato
// under og over enhver grænse og afviser enhver besked, der siger «skade» om datoen.

const STAMDATA_SKADESTYPE_ID = 'stamdata.skadestype';
const DEPENDENCY_DATE = '2020-06-01';

/**
 * To erhvervssygdomssager: én, hvor alle øvrige afhængigheder er udfyldt, og én, hvor kun Stamdata er.
 * Begge behøves: en udfyldt nabodato (fx Forsørgertabs virkningsdato) kan overtage grænsen og skjule, at
 * skade-/anmeldelsesdato-grenen bag den mangler sin reference.
 */
const erhvervssygdomViews: ReadonlyArray<CanonicalView> = [
  {
    readCanonical: <T>(field: FieldRef<T>): T => (
      field.descriptor.id === STAMDATA_SKADESTYPE_ID ? 'Erhvervssygdom' : DEPENDENCY_DATE
    ) as T,
    listEntityIds: () => [],
  } as CanonicalView,
  {
    readCanonical: <T>(field: FieldRef<T>): T => (
      field.descriptor.id === STAMDATA_SKADESTYPE_ID
        ? 'Erhvervssygdom'
        : field.descriptor.id.startsWith('stamdata.') ? DEPENDENCY_DATE : undefined
    ) as T,
    listEntityIds: () => [],
  } as CanonicalView,
];

const SKADE_TERM = /skades?dato|skades?tidspunkt|skadesår|skaden/iu;

const dateFields = productionInputFields.filter((field) => field.codec.family === 'date');

const bindWithSyntheticRows = (field: FieldDescriptor<unknown>): FieldRef<unknown> =>
  field.bind(...field.template.path.flatMap((segment) => segment.kind === 'entity' ? ['row-1'] : []));

const messagesFor = (field: FieldDescriptor<unknown>, iso: string): readonly string[] => {
  const ref = bindWithSyntheticRows(field);
  return erhvervssygdomViews.flatMap((view) => (field.validators ?? []).flatMap((validate) => {
    const issue = validate(iso, ref, view);
    return issue === undefined ? [] : [issue.message];
  }));
};

describe('dateBoundsStamdataDatoNavn', () => {
  it('finder datofelter, og prøven fremkalder beskeder om anmeldelsesdatoen (værnet er ikke grønt af tomhed)', () => {
    expect(dateFields.length).toBeGreaterThanOrEqual(50);
    const anmeldelsesBeskeder = dateFields
      .flatMap((field) => messagesFor(field, '2020-05-01'))
      .filter((message) => /anmeldelsesdato/iu.test(message));
    expect(anmeldelsesBeskeder.length).toBeGreaterThan(0);
  });

  it.each(dateFields.map((field) => [field.id, field] as const))(
    '%s navngiver ikke datoen som skadedato ved en erhvervssygdom',
    (_id, field) => {
      const messages = [
        ...messagesFor(field, '1900-01-02'),
        ...messagesFor(field, '2020-05-01'),
        ...messagesFor(field, '2100-12-30'),
      ];
      expect(messages.filter((message) => SKADE_TERM.test(message))).toEqual([]);
    },
  );
});
