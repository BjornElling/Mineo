import {
  __resetProductionInputCatalogForTests,
  buildProductionInputCatalog,
  getProductionInputCatalog,
  resolveTopLevelFieldRef,
} from '../../input/catalog/productionInputCatalog';
import { PERSISTED_SECTION_KEYS, persistenceSchemas } from '../../config/persistenceRegistry';
import { createEmptyPersistedInputSections, createPersistedInputStateSchema } from '../../input/inputState';
import { createInputReader, createInputRevision } from '../../input/inputReader';
import type { InputCatalog } from '../../input/fieldCatalog';
import type { PersistedInputSections } from '../../input/inputState';
import { rentekravRowsBinding } from '../../input/catalog/renteberegningInputBindings';
import {
  eoBilagSelectionOpgoerelseBinding,
  eoSfggAnsaettelsesforholdBinding,
  eoSfggSatsvalgBinding,
} from '../../input/catalog/erstatningsopgoerelseInputBindings';
import { sygeferiegodtgoerelseAnsaettelsesforholdRowSchema } from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import type { StorageKey } from '../../config/storageManifest';

afterEach(() => {
  __resetProductionInputCatalogForTests();
});

/** Bygger en branded, katalogvalideret aggregate fra rå sektioner. */
const readerFor = (catalog: InputCatalog, sections: PersistedInputSections) => {
  const input = createPersistedInputStateSchema(catalog).parse({ sections, rejectedInputs: {} });
  return createInputReader({ input, revision: createInputRevision(1), catalog });
};

describe('produktions-InputCatalog', () => {
  it('bygges og forsegles uden registrerings- eller parent-invariantfejl', () => {
    expect(() => buildProductionInputCatalog()).not.toThrow();
    expect(buildProductionInputCatalog().isSealed).toBe(true);
  });

  it('er en stabil singleton indtil reset', () => {
    const first = getProductionInputCatalog();
    expect(getProductionInputCatalog()).toBe(first);
    __resetProductionInputCatalogForTests();
    expect(getProductionInputCatalog()).not.toBe(first);
  });

  it('accepterer et tomt aggregat mod state-schemaet (alle empty sections er schema-gyldige)', () => {
    const catalog = getProductionInputCatalog();
    // Et tomt aggregat med null-sektioner skal validere; det beviser at katalogets
    // createEmptySection-forudsætninger ikke i sig selv kræver en bestemt sektionsværdi.
    const sections = createEmptyPersistedInputSections();
    for (const section of PERSISTED_SECTION_KEYS) {
      expect(sections[section]).toBeNull();
    }
    expect(readerFor(catalog, sections).revision).toBe(1);
  });

  it('round-tripper et migreret top-level felt gennem writeCanonical/read', () => {
    const catalog = getProductionInputCatalog();
    const field = resolveTopLevelFieldRef('satser', 'aargang');
    expect(field).not.toBeNull();

    const sections = catalog.writeCanonical(createEmptyPersistedInputSections(), field!, 2025);
    const parsed = persistenceSchemas.satser.parse(sections.satser);
    expect(parsed).toEqual({ aargang: 2025 });

    expect(readerFor(catalog, sections).read(field!)).toEqual({ status: 'valid', value: 2025 });
  });

  it('resolver top-level felter for alle domæner og afviser ukendte', () => {
    // Stikprøve på tværs af domæner: hvert felt skal kunne resolves til en gyldig FieldRef.
    const known: ReadonlyArray<readonly [StorageKey, string]> = [
      ['stamdata', 'journalnr'],
      ['satser', 'aargang'],
      ['aarsloen', 'feriePct'],
      ['faellesAarsloen', 'aslAarsloen'],
      ['renteberegning', 'beregningsdato'],
      ['varigemen', 'mengrad'],
      ['forsoergertab', 'koen'],
      ['erhvervsevnetab', 'ealEetPct'],
      ['erstatningsopgoerelse', 'eoNummer'],
    ];
    for (const [section, field] of known) {
      const ref = resolveTopLevelFieldRef(section, field);
      expect(ref, `${section}.${field}`).not.toBeNull();
      expect(ref!.address.section).toBe(section);
      expect(ref!.address.field).toBe(field);
      expect(ref!.address.path).toHaveLength(0);
    }
    expect(resolveTopLevelFieldRef('satser', 'findes-ikke')).toBeNull();
    // Nested/rækkefelter er ikke top-level og resolves ikke via skalar-sporet.
    expect(resolveTopLevelFieldRef('erstatningsopgoerelse', 'tilstand')).toBeNull();
  });

  it('opererer på registrerede samlinger (rentekrav) uden fejl', () => {
    const catalog = getProductionInputCatalog();
    let sections = catalog.insertEntity(
      createEmptyPersistedInputSections(),
      rentekravRowsBinding,
      rentekravRowsBinding.createRef(),
      createEmptyRentekravCommittedRow('a')
    );
    sections = catalog.insertEntity(
      sections,
      rentekravRowsBinding,
      rentekravRowsBinding.createRef(),
      createEmptyRentekravCommittedRow('b')
    );
    expect(catalog.listEntityIds(sections, rentekravRowsBinding.createRef())).toEqual(['a', 'b']);
  });

  it('håndterer en samling med custom entity-id (sfggAnsaettelsesforhold → ansaettelsesforholdId)', () => {
    const catalog = getProductionInputCatalog();
    const row = sygeferiegodtgoerelseAnsaettelsesforholdRowSchema.parse({ ansaettelsesforholdId: 'af-1' });
    const otherRow = sygeferiegodtgoerelseAnsaettelsesforholdRowSchema.parse({ ansaettelsesforholdId: 'af-2' });

    // Indsæt to rækker; catalogets getEntityId skal læse `ansaettelsesforholdId`, ikke `id`.
    let sections = catalog.insertEntity(
      createEmptyPersistedInputSections(),
      eoSfggAnsaettelsesforholdBinding,
      eoSfggAnsaettelsesforholdBinding.createRef(),
      row
    );
    sections = catalog.insertEntity(sections, eoSfggAnsaettelsesforholdBinding, eoSfggAnsaettelsesforholdBinding.createRef(), otherRow);
    expect(catalog.listEntityIds(sections, eoSfggAnsaettelsesforholdBinding.createRef())).toEqual(['af-1', 'af-2']);

    // Skriv et rækkefelt på den anden række via en bundet ref (entity-led resolver på custom id).
    const satsvalgRef = eoSfggSatsvalgBinding.createRef('af-2');
    expect(satsvalgRef.address.path).toEqual([{ kind: 'entity', collection: 'sfggAnsaettelsesforhold', entityId: 'af-2' }]);
    const written = catalog.writeCanonical(sections, satsvalgRef, 'Faglaert-Koebenhavn');

    // Read-back gennem reader; nabo-rækken forbliver urørt.
    const reader = readerFor(catalog, written);
    expect(reader.read(satsvalgRef)).toEqual({ status: 'valid', value: 'Faglaert-Koebenhavn' });
    expect(reader.read(eoSfggSatsvalgBinding.createRef('af-1'))).toEqual({ status: 'valid', value: undefined });
  });

  it('round-tripper et nested boolean-bilagsvalg (eoBilagSelection) via property-pathen', () => {
    const catalog = getProductionInputCatalog();
    const field = eoBilagSelectionOpgoerelseBinding.createRef();
    expect(field.address.path).toEqual([{ kind: 'property', name: 'eoBilagSelection' }]);

    // Skrivning ind i en tom sag: createEmptySection skal levere det nested objekt, så writeCanonical
    // kan sætte boolean'en uden at opdigte en delvis struktur.
    const sections = catalog.writeCanonical(createEmptyPersistedInputSections(), field, false);
    const parsed = persistenceSchemas.erstatningsopgoerelse.parse(sections.erstatningsopgoerelse);
    expect(parsed.eoBilagSelection.opgoerelse).toBe(false);

    expect(readerFor(catalog, sections).read(field)).toEqual({ status: 'valid', value: false });
  });
});
