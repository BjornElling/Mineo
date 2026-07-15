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
  eoForligAnsvarsgradBroekBinding,
  eoSfggAnsaettelsesforholdBinding,
  eoSfggSatsvalgBinding,
} from '../../input/catalog/erstatningsopgoerelseInputBindings';
import {
  eoLoenCollectionBindings,
  eoLoenFieldBindings,
  eoAngivetLoenManualPercentRowsBinding,
  eoAngivetLoenManualRowsBinding,
  eoLoenindkomstAnsaettelsesforholdBinding,
  eoLoenindkomstManualPercentRowsBinding,
  eoLoenindkomstManualRowsBinding,
  eoLoenindkomstStandardRowsBinding,
} from '../../input/catalog/erstatningsopgoerelseLoenInputBindings';
import {
  aarsloenTableCol0MaanedBinding,
  aarsloenTableCol0UgeBinding,
  aarsloenTableCol1MaanedBinding,
  aarsloenTableCol1UgeBinding,
  aarsloenTableDataBinding,
} from '../../input/catalog/aarsloenInputBindings';
import { sygeferiegodtgoerelseAnsaettelsesforholdRowSchema } from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import type { StorageKey } from '../../config/storageManifest';
import {
  initialLoenudviklingManuelProcentsatsRow,
  initialLoenudviklingManuelRow,
  initialRow,
} from '../../domain/erstatningsopgoerelse/helpers/eoRowInitialValues';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

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

  it('registrerer forligAnsvarsgradBroek med brøk-codecet (matcher StyledFractionField, ikke fritekst)', () => {
    const codec = eoForligAnsvarsgradBroekBinding.definition.codec;

    // Brøk-codec, ikke fritekst: en gyldig brøk forkortes/valideres, og en ugyldig brøk afvises.
    // (Et fritekst-codec ville acceptere "2/x" som canonical streng.)
    expect(codec.parseForSettle('1/3')).toEqual({ status: 'valid', value: '1/3' });
    expect(codec.parseForSettle('2/x')).toEqual({ status: 'invalid' });
    // Tom brøk = canonical tomhed; kanttegn afskæres som i UI-controllen.
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
    expect(codec.parseForSettle(' (1/3) ')).toEqual({ status: 'valid', value: '1/3' });

    // Round-trip gennem katalogets writeCanonical/read for det top-level felt.
    const catalog = getProductionInputCatalog();
    const field = resolveTopLevelFieldRef('erstatningsopgoerelse', 'forligAnsvarsgradBroek');
    expect(field).not.toBeNull();
    const sections = catalog.writeCanonical(createEmptyPersistedInputSections(), field!, '1/3');
    expect(readerFor(catalog, sections).read(field!)).toEqual({ status: 'valid', value: '1/3' });
  });

  it('bevarer standardløn-tabellens canonical strenge gennem de fælles tal- og ugecodecs', () => {
    const catalog = getProductionInputCatalog();
    let sections = catalog.insertEntity(
      createEmptyPersistedInputSections(),
      aarsloenTableDataBinding,
      aarsloenTableDataBinding.createRef(),
      { ...initialRow, id: 'loen-1' }
    );

    const maaned = aarsloenTableCol0MaanedBinding.createRef('loen-1');
    const aar = aarsloenTableCol1MaanedBinding.createRef('loen-1');
    const ugeFra = aarsloenTableCol0UgeBinding.createRef('loen-1');
    const ugeTil = aarsloenTableCol1UgeBinding.createRef('loen-1');
    expect(maaned.definition.codec.parseForSettle('07')).toEqual({ status: 'valid', value: '7' });
    expect(aar.definition.codec.parseForSettle('2024')).toEqual({ status: 'valid', value: '2024' });
    expect(ugeFra.definition.codec.parseForSettle('1/2024')).toEqual({ status: 'valid', value: '01/2024' });
    expect(maaned.definition.codec.parseForSettle(' (07) ')).toEqual({ status: 'valid', value: '7' });
    expect(aar.definition.codec.parseForSettle(' (2024) ')).toEqual({ status: 'valid', value: '2024' });
    expect(ugeFra.definition.codec.parseForSettle(' (1/2024) ')).toEqual({ status: 'valid', value: '01/2024' });
    expect(maaned.definition.codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(aar.definition.codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(ugeFra.definition.codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });

    sections = catalog.writeCanonical(sections, maaned, '7');
    sections = catalog.writeCanonical(sections, aar, '2024');
    sections = catalog.writeCanonical(sections, ugeFra, '01/2024');
    sections = catalog.writeCanonical(sections, ugeTil, '02/2024');

    const parsed = persistenceSchemas.aarsloen.parse(sections.aarsloen);
    expect(parsed.tableData[0]).toMatchObject({
      col0_maaned: '7',
      col1_maaned: '2024',
      col0_uge: '01/2024',
      col1_uge: '02/2024',
    });
    expect(typeof parsed.tableData[0]?.col0_maaned).toBe('string');
    expect(JSON.stringify(parsed.tableData[0])).toContain('"col0_maaned":"7"');
    expect(readerFor(catalog, sections).read(maaned)).toEqual({ status: 'valid', value: '7' });

    const cleared = persistenceSchemas.aarsloen.parse(
      catalog.writeCanonical(sections, maaned, '').aarsloen
    );
    expect(cleared.tableData[0]?.col0_maaned).toBe('');
    expect(JSON.stringify(cleared.tableData[0])).toContain('"col0_maaned":""');
  });

  it('registrerer hele EO-løntræet og round-tripper en nested standardlønscelle', () => {
    const catalog = getProductionInputCatalog();

    for (const binding of eoLoenFieldBindings) {
      const entityIds = binding.template.path
        .filter((segment) => segment.kind === 'entity')
        .map((_, index) => `entity-${index + 1}`);
      expect(catalog.isKnownField(binding.createRef(...entityIds))).toBe(true);
    }

    const employment = { ...createDefaultLoenindkomstAnsaettelsesforhold(), id: 'af-1' };
    let sections = catalog.insertEntity(
      createEmptyPersistedInputSections(),
      eoLoenindkomstAnsaettelsesforholdBinding,
      eoLoenindkomstAnsaettelsesforholdBinding.createRef(),
      employment
    );
    sections = catalog.insertEntity(
      sections,
      eoLoenindkomstStandardRowsBinding,
      eoLoenindkomstStandardRowsBinding.createRef('af-1'),
      { ...initialRow, id: 'loen-1' }
    );

    const monthBinding = eoLoenFieldBindings.find((binding) =>
      binding.template.field === 'col0_maaned'
      && binding.template.path.some((segment) => segment.kind === 'entity' && segment.collection === 'indtaegtsoplysningerTableData')
    );
    expect(monthBinding).toBeDefined();
    const month = monthBinding!.createRef('af-1', 'loen-1');
    expect(month.definition.codec.parseForSettle('09')).toEqual({ status: 'valid', value: '9' });
    sections = catalog.writeCanonical(sections, month, '9');

    const parsed = persistenceSchemas.erstatningsopgoerelse.parse(sections.erstatningsopgoerelse);
    expect(parsed.loenindkomstAnsaettelsesforhold[0]?.indtaegtsoplysningerTableData[0]?.col0_maaned).toBe('9');
    expect(readerFor(catalog, sections).read(month)).toEqual({ status: 'valid', value: '9' });

    const findField = (
      owner: 'employment' | 'eo-property',
      collection: string | null,
      field: string
    ) => eoLoenFieldBindings.find((binding) => {
      if (binding.template.field !== field) return false;
      const hasEmployment = binding.template.path.some((segment) =>
        segment.kind === 'entity' && segment.collection === 'loenindkomstAnsaettelsesforhold'
      );
      const hasEoProperty = binding.template.path.some((segment) =>
        segment.kind === 'property' && segment.name === 'eoAngivetLoenLoenudvikling'
      );
      const hasCollection = collection === null || binding.template.path.some((segment) =>
        segment.kind === 'entity' && segment.collection === collection
      );
      return (owner === 'employment' ? hasEmployment : hasEoProperty) && hasCollection;
    });

    sections = catalog.insertEntity(
      sections,
      eoLoenindkomstManualRowsBinding,
      eoLoenindkomstManualRowsBinding.createRef('af-1'),
      { ...initialLoenudviklingManuelRow, id: 'manuel-af-1' }
    );
    sections = catalog.insertEntity(
      sections,
      eoLoenindkomstManualPercentRowsBinding,
      eoLoenindkomstManualPercentRowsBinding.createRef('af-1'),
      { ...initialLoenudviklingManuelProcentsatsRow, id: 'manuel-pct-af-1' }
    );
    sections = catalog.insertEntity(
      sections,
      eoAngivetLoenManualRowsBinding,
      eoAngivetLoenManualRowsBinding.createRef(),
      { ...initialLoenudviklingManuelRow, id: 'manuel-eo-1' }
    );
    sections = catalog.insertEntity(
      sections,
      eoAngivetLoenManualPercentRowsBinding,
      eoAngivetLoenManualPercentRowsBinding.createRef(),
      { ...initialLoenudviklingManuelProcentsatsRow, id: 'manuel-pct-eo-1' }
    );

    const employmentManualPercent = findField('employment', 'loenudviklingManuelTableData', 'feriepenge');
    const employmentPercentRow = findField('employment', 'loenudviklingManuelProcentsatsTableData', 'procent');
    const eoManualPercent = findField('eo-property', 'loenudviklingManuelTableData', 'feriepenge');
    const eoPercentRow = findField('eo-property', 'loenudviklingManuelProcentsatsTableData', 'procent');
    const eoLoenTrin = findField('eo-property', null, 'offentligLoenTrin');
    expect([employmentManualPercent, employmentPercentRow, eoManualPercent, eoPercentRow, eoLoenTrin])
      .not.toContain(undefined);

    sections = catalog.writeCanonical(sections, employmentManualPercent!.createRef('af-1', 'manuel-af-1'), 12.5);
    sections = catalog.writeCanonical(sections, employmentPercentRow!.createRef('af-1', 'manuel-pct-af-1'), 3.5);
    sections = catalog.writeCanonical(sections, eoManualPercent!.createRef('manuel-eo-1'), 10);
    sections = catalog.writeCanonical(sections, eoPercentRow!.createRef('manuel-pct-eo-1'), 4);
    sections = catalog.writeCanonical(sections, eoLoenTrin!.createRef(), 12);

    const nestedParsed = persistenceSchemas.erstatningsopgoerelse.parse(sections.erstatningsopgoerelse);
    expect(nestedParsed.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelTableData[0]?.feriepenge).toBe(12.5);
    expect(nestedParsed.loenindkomstAnsaettelsesforhold[0]?.loenudviklingManuelProcentsatsTableData[0]?.procent).toBe(3.5);
    expect(nestedParsed.eoAngivetLoenLoenudvikling.loenudviklingManuelTableData[0]?.feriepenge).toBe(10);
    expect(nestedParsed.eoAngivetLoenLoenudvikling.loenudviklingManuelProcentsatsTableData[0]?.procent).toBe(4);
    expect(nestedParsed.eoAngivetLoenLoenudvikling.offentligLoenTrin).toBe(12);

    // Alle seks samlinger (parent + nested tabeller i begge EO-løngrene) er med i kataloggruppen.
    expect(eoLoenCollectionBindings).toHaveLength(6);
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
