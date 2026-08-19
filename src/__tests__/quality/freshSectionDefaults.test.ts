import { getProductionInputCatalog } from '../../inputCore/catalog/productionCatalog';
import { productionInputFields } from '../../inputCore/catalog/productionCatalog';
import { clearField, reduceInputCommand } from '../../inputCore/inputReducer';
import { createEmptySettledInput } from '../../inputCore/settledInput';
import { readCanonicalAtAddress } from '../../inputCore/structuralAccessors';
import type { FieldDescriptor } from '../../inputCore/fieldDescriptor';
import type { SectionKey } from '../../inputCore/fieldAddress';

/**
 * VÆRN: descriptorens tomværdi og den FØRST MATERIALISEREDE sektions værdi skal være enige.
 *
 * En sektion er `null`, indtil brugeren rører sit første felt på siden; først dér oprettes den fra
 * `createEmpty<Sektion>Section` og sanereres gennem det persisterede schema. Alt, hvad sektionen har i det
 * øjeblik, er altså schemaets defaults – ikke descriptorens.
 *
 * Descriptorens `emptyValue` er samtidig den værdi, readerprojektionerne falder tilbage til (`readOrEmpty`),
 * og den værdi et `clearField` skriver. Er de to uenige, har feltet TO forskellige defaults, og hvilken en
 * domænet ser, afhænger af, om sektionen tilfældigvis er materialiseret endnu. Det var præcis den split:
 * `eoAngivetLoenLoenudvikling.loenPaaHelligdage` lovede i sin ansættelses-tvilling 'Almindelig løn', men gav
 * en nyoprettet sag `undefined` – en tilstand EO-motoren erklærede umulig og fail-closede på.
 *
 * Testen dækker de STATISKE felter (ingen entity-led i adressen). Rækkefelter har ikke en "fersk sektion"
 * at blive målt imod: deres defaults kommer fra rækkefabrikkerne ved indsættelse.
 */

type AnyDescriptor = FieldDescriptor<unknown>;

const catalog = getProductionInputCatalog();

const isStaticField = (descriptor: AnyDescriptor): boolean =>
  descriptor.template.path.every((segment) => segment.kind === 'property');

const staticFields = (productionInputFields as readonly AnyDescriptor[]).filter(isStaticField);

const sections = [...new Set(staticFields.map((descriptor) => descriptor.template.section))] as SectionKey[];

/**
 * Materialiserer sektionen på præcis samme måde som produktionen: ét `clearField` på sektionens FØRSTE
 * statiske felt får reduceren til at kalde `createEmptySection` og validere gennem det persisterede schema.
 * Ankerfeltet udelades af målingen, fordi commanden selv har skrevet dets tomværdi.
 */
const materializeSection = (section: SectionKey) => {
  const fieldsInSection = staticFields.filter((descriptor) => descriptor.template.section === section);
  const anchor = fieldsInSection[0];
  if (anchor === undefined) throw new Error(`Sektionen ${section} har ingen statiske felter`);
  const result = reduceInputCommand(createEmptySettledInput(), clearField(anchor.bind()), catalog);
  return { sections: result.input.sections, anchorId: anchor.id, fieldsInSection };
};

describe('fersk sektion: descriptorens tomværdi er sektionens faktiske default', () => {
  it.each(sections)('%s', (section) => {
    const { sections: materialized, anchorId, fieldsInSection } = materializeSection(section);

    const uenige = fieldsInSection
      .filter((descriptor) => descriptor.id !== anchorId)
      .map((descriptor) => ({
        id: descriptor.id,
        iSektionen: readCanonicalAtAddress(materialized, descriptor.bind().address),
        emptyValue: descriptor.emptyValue,
      }))
      .filter((row) => !Object.is(row.iSektionen, row.emptyValue));

    expect(
      uenige,
      `Felter hvor en nyoprettet ${section}-sektion og descriptorens tomværdi er uenige:\n`
      + uenige.map((row) => `  ${row.id}: sektion=${JSON.stringify(row.iSektionen)} `
        + `emptyValue=${JSON.stringify(row.emptyValue)}`).join('\n')
    ).toEqual([]);
  });

  it('måler faktisk noget (ikke grøn af tomhed)', () => {
    expect(staticFields.length).toBeGreaterThan(50);
    expect(sections.length).toBeGreaterThan(5);
  });

  it('fanger en split-default på den LEVENDE descriptor (mutationstest)', () => {
    // Mutationen rammer måle-mekanismen, ikke testdataene: vi beholder produktionens materialiserede
    // sektion og bytter kun descriptorens erklærede tomværdi ud. Fanger sammenligningen ikke DEN, kan den
    // heller ikke fange en fremtidig descriptor, der lover en anden default end schemaet giver.
    const { sections: materialized } = materializeSection('erstatningsopgoerelse');
    const helligdage = staticFields.find(
      (descriptor) => descriptor.id === 'eo.eoAngivetLoenLoenudvikling.loenPaaHelligdage'
    );
    if (helligdage === undefined) throw new Error('Descriptoren findes ikke længere');

    const iSektionen = readCanonicalAtAddress(materialized, helligdage.bind().address);
    expect(iSektionen).toBe(helligdage.emptyValue);
    expect(helligdage.emptyValue).not.toBeUndefined();

    // Den muterede descriptor: samme adresse, anden lovet tomværdi (den gamle, valgfrie form).
    const muteret: AnyDescriptor = { ...helligdage, emptyValue: undefined };
    expect(Object.is(iSektionen, muteret.emptyValue)).toBe(false);
  });
});
