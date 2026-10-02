import type { ValidationError } from '../../../types/validation';
import type { EoInvariant } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  buildControlMismatchInvariant,
  buildMidlertidigtEetSourceInvariants,
  buildStructuralFieldIssueInvariants,
  buildTafPerYearAfrundingInvariant,
  buildTafPerYearOpreguleretManglendeReguleringssatsInvariant,
  buildTafPerYearUnavailableInvariant,
  buildValidationInvariants,
  getAuthoritativeBlockingInvariants,
  getBlockingInvariantsForOutput,
  hasAnyErrorInvariant,
  hasAnyWarningInvariant,
  hasAuthoritativeBlockingInvariant,
  suppressMaskedMissingInvariants,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotInvariants';
import { TAF_OVERLAP_ERROR_MESSAGE } from '../../../validators/erstatningsopgoerelseValidator';
import {
  OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE,
  OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE,
} from '../../../domain/erstatningsopgoerelse/validation/oevrigeKravRowValidation';
import {
  FRA_DATO_IKKE_ANGIVET_MESSAGE,
  FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE,
  TIL_DATO_IKKE_ANGIVET_MESSAGE,
} from '../../../domain/erstatningsopgoerelse/validation/tafRowRules';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { FieldAddress, FieldAddressPathSegment } from '../../../inputCore/fieldAddress';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { EetIssue } from '../../../domain/erhvervsevnetab/eetTypes';
import { moneyOre } from '../../../domain/money/money';

const makeValues = () => {
  const values = createErstatningsopgoerelseInitialValues();
  values.tafPerioder = [{ id: 'taf-1', fra: undefined, til: undefined, loseFeriedage: 0 }];
  values.svieSmertePerioder = [{ id: 'ss-1', fra: undefined, til: undefined, tilstand: 'sygemeldt' }];
  values.oevrigeKravPerioder = [{ id: 'krav-1', dato: undefined, udgiftTil: undefined, beloeb: undefined }];
  return values;
};

const makeFieldIssue = (
  address: FieldAddress,
  descriptorId = `eo.${address.field}`,
  message = 'Ugyldig værdi'
): FieldIssue => ({
  kind: 'field',
  code: 'test_issue',
  severity: 'error',
  reason: 'format',
  message,
  field: {
    address,
    descriptor: { id: descriptorId, label: descriptorId },
  } as unknown as FieldIssue['field'],
});

const entityAddress = (
  collection: string,
  entityId: string,
  field: string,
  path: readonly FieldAddressPathSegment[] = []
): FieldAddress => ({
  section: 'erstatningsopgoerelse',
  path: [...path, { kind: 'entity', collection, entityId }],
  field,
});

const invariant = (overrides: Partial<EoInvariant>): EoInvariant => ({
  id: 'test',
  passed: false,
  severity: 'error',
  source: 'system',
  message: 'Testfejl',
  blocksAuthoritativeComputation: false,
  blocksOutputs: [],
  ...overrides,
});

describe('eoSnapshotInvariants – direkte partitioner', () => {
  it('bygger deterministiske validation-id’er og skelner warning fra blokkerende fejl', () => {
    const errors: ValidationError[] = [
      { path: 'tafPerioder[0].fra', message: TAF_OVERLAP_ERROR_MESSAGE },
      { path: 'tafPerioder[0].loseFeriedage', message: 'For mange dage' },
      { path: 'uspecificeredeFerieFridage', message: 'Manglende værdi', severity: 'warning' },
      { path: 'andetFelt', message: 'Ugyldigt felt' },
      { path: undefined as unknown as string, message: 'Uden sti' },
    ];

    expect(buildValidationInvariants(errors)).toEqual([
      expect.objectContaining({ id: 'taf_perioder:overlap:tafPerioder[0].fra', blocksAuthoritativeComputation: true }),
      expect.objectContaining({ id: 'taf_perioder:lose_feriedage:tafPerioder[0].loseFeriedage', blocksAuthoritativeComputation: true }),
      expect.objectContaining({ id: 'validation:uspecificeredeFerieFridage', severity: 'warning', blocksOutputs: [] }),
      expect.objectContaining({ id: 'validation:andetFelt', blocksAuthoritativeComputation: true }),
      expect.objectContaining({ id: 'validation:4', evidence: undefined }),
    ]);
  });

  it('undertrykker kun masking-mangler for den samme række og det samme felt', () => {
    const values = makeValues();
    const issue = makeFieldIssue(entityAddress('tafPerioder', 'taf-1', 'fra'));
    const noIssues = [invariant({ id: 'keep', source: 'validation', message: 'Fra-dato mangler' })];
    expect(suppressMaskedMissingInvariants(noIssues, [], values)).toBe(noIssues);

    const invariants = [
      invariant({ id: 'masked', message: 'Fra-dato mangler', evidence: ['tafPerioder[0].fra'] }),
      invariant({ id: 'other-row', message: 'Fra-dato mangler', evidence: ['tafPerioder[1].fra'] }),
      invariant({ id: 'other-message', message: 'Anden regel', evidence: ['tafPerioder[0].fra'] }),
      invariant({ id: 'no-evidence', message: TIL_DATO_IKKE_ANGIVET_MESSAGE }),
    ];

    const result = suppressMaskedMissingInvariants(invariants, [issue], values);
    expect(result.map(({ id }) => id)).toEqual(['other-row', 'other-message', 'no-evidence']);
    expect(suppressMaskedMissingInvariants(invariants, [makeFieldIssue(entityAddress('ukendt', 'taf-1', 'fra'))], values)).toHaveLength(4);
    expect(suppressMaskedMissingInvariants(invariants, [makeFieldIssue(entityAddress('tafPerioder', 'ukendt', 'fra'))], values)).toHaveLength(4);
    expect(suppressMaskedMissingInvariants(invariants, [makeFieldIssue(entityAddress('tafPerioder', 'taf-1', 'andet'))], values)).toHaveLength(4);

    const nestedIssue = makeFieldIssue(entityAddress('oevrigeKravPerioder', 'krav-1', 'beloeb', [
      { kind: 'property', name: 'nested' },
    ]));
    const nestedInvariant = invariant({ id: 'nested', message: OEVRIGE_KRAV_BELOEB_MANGLER_MESSAGE, evidence: ['oevrigeKravPerioder[0].beloeb'] });
    expect(suppressMaskedMissingInvariants([nestedInvariant], [nestedIssue], values)).toEqual([]);
  });

  it('bygger reader-feltinvarianter med og uden entity-suffix', () => {
    const propertyIssue = makeFieldIssue({ section: 'erstatningsopgoerelse', path: [], field: 'forlig' }, 'eo.forlig', 'Forlig mangler');
    const nestedIssue = makeFieldIssue(entityAddress('tafPerioder', 'taf-1', 'fra', [
      { kind: 'entity', collection: 'outer', entityId: 'outer-1' },
    ]), 'eo.tafPerioder.fra', 'Fra mangler');
    const propertyThenEntityIssue = makeFieldIssue(entityAddress('tafPerioder', 'taf-1', 'til', [
      { kind: 'property', name: 'periode' },
    ]), 'eo.tafPerioder.til', 'Til mangler');
    expect(buildStructuralFieldIssueInvariants([propertyIssue, nestedIssue, propertyThenEntityIssue])).toEqual([
      expect.objectContaining({ id: 'reader_field:eo.forlig', evidence: ['eo.forlig'] }),
      expect.objectContaining({ id: 'reader_field:eo.tafPerioder.fra#outer-1.taf-1', evidence: ['eo.tafPerioder.fra'] }),
      expect.objectContaining({ id: 'reader_field:eo.tafPerioder.til#taf-1', evidence: ['eo.tafPerioder.til'] }),
    ]);
  });

  it('projekterer midlertidigt EET med forskellig severity', () => {
    const issues: EetIssue[] = [
      { id: 'eet-error', severity: 'error', message: 'EET-fejl' },
      { id: 'eet-warning', severity: 'warning', message: 'EET-advarsel' },
    ];
    expect(buildMidlertidigtEetSourceInvariants(issues)).toEqual([
      expect.objectContaining({ id: 'midlertidigt_eet_source:eet-error', blocksAuthoritativeComputation: true, blocksOutputs: expect.any(Array) }),
      expect.objectContaining({ id: 'midlertidigt_eet_source:eet-warning', blocksAuthoritativeComputation: false, blocksOutputs: [] }),
    ]);
  });

  it('bygger de systemmæssige TAF- og kontrolinvarianter for begge beskedpartitioner', () => {
    expect(buildTafPerYearAfrundingInvariant({ afrundingOre: moneyOre(101), sumYearTafOre: moneyOre(899), samletTafKravOre: moneyOre(1000) })).toEqual(
      expect.objectContaining({ id: 'taf_per_year:afrunding_over_100', evidence: ['Afrunding: 101', 'Årssum: 899', 'Samlet TAF-krav: 1000'] })
    );
    expect(buildTafPerYearOpreguleretManglendeReguleringssatsInvariant([2022, 2023]).message).toContain('2022, 2023');
    expect(buildTafPerYearOpreguleretManglendeReguleringssatsInvariant([]).message).toContain('mangler reguleringssats.');
    expect(buildTafPerYearUnavailableInvariant('missing_loenudvikling').message).toContain('lønudvikling');
    expect(buildTafPerYearUnavailableInvariant('missing_taf_indtaegter').message).toContain('indtægter');
    expect(buildControlMismatchInvariant(['første mismatch', 'anden mismatch'])).toEqual(
      expect.objectContaining({ id: 'control:sammentaelling_mismatch', evidence: ['første mismatch', 'anden mismatch'] })
    );
  });

  it('finder blokerende invarianter, fejl, advarsler og outputbeskeder', () => {
    const invariants = [
      invariant({ id: 'auth', message: 'Autoritativ fejl', blocksAuthoritativeComputation: true, blocksOutputs: ['eo_pdf'] }),
      invariant({ id: 'output', message: 'Dokumentfejl', blocksOutputs: ['eo_pdf'] }),
      invariant({ id: 'warning', severity: 'warning', message: 'Advarsel', blocksAuthoritativeComputation: false }),
      invariant({ id: 'passed', passed: true, message: 'Bestået', blocksAuthoritativeComputation: true }),
      invariant({ id: 'no-outputs', blocksOutputs: undefined }),
    ];

    expect(hasAuthoritativeBlockingInvariant(invariants)).toBe(true);
    expect(getAuthoritativeBlockingInvariants(invariants).map(({ id }) => id)).toEqual(['auth']);
    expect(hasAnyErrorInvariant(invariants)).toBe(true);
    expect(hasAnyWarningInvariant(invariants)).toBe(true);
    expect(getBlockingInvariantsForOutput(invariants, 'eo_pdf').map(({ id }) => id)).toEqual(['auth', 'output']);
    expect(buildBlockingMessageForOutput(invariants, 'eo_pdf', 'fallback')).toBe('Autoritativ fejl; Dokumentfejl');
    expect(buildBlockingMessageForOutput(invariants, 'beregning', 'fallback')).toBe('fallback');
  });

  it('bevarer beskeder uden evidence og de øvrige masking-mangler', () => {
    const values = makeValues();
    const issue = makeFieldIssue(entityAddress('svieSmertePerioder', 'ss-1', 'til'));
    const invariants = [
      invariant({ id: 'til', message: TIL_DATO_IKKE_ANGIVET_MESSAGE, evidence: ['svieSmertePerioder[0].til'] }),
      invariant({ id: 'begge', message: FRA_OG_TIL_DATO_IKKE_ANGIVET_MESSAGE, evidence: ['svieSmertePerioder[0].til'] }),
      invariant({ id: 'fra', message: FRA_DATO_IKKE_ANGIVET_MESSAGE, evidence: ['svieSmertePerioder[0].fra'] }),
      invariant({ id: 'udgift', message: OEVRIGE_KRAV_UDGIFT_TIL_MANGLER_MESSAGE, evidence: ['oevrigeKravPerioder[0].udgiftTil'] }),
    ];
    expect(suppressMaskedMissingInvariants(invariants, [issue], values).map(({ id }) => id)).toEqual(['fra', 'udgift']);
    expect(suppressMaskedMissingInvariants([invariant({ id: 'missing-evidence', message: TIL_DATO_IKKE_ANGIVET_MESSAGE })], [issue], values)).toHaveLength(1);
  });
});
