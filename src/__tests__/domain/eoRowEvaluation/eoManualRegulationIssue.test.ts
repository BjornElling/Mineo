import {
  createDefaultLoenindkomstAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { resolveManualRegulationIssue } from '../../../domain/eoRowEvaluation/eoManualRegulationIssue';
import {
  eoAngivetLoenFields,
  eoEmploymentFields,
  eoEmploymentManual,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import type {
  LoenudviklingManuelProcentsatsRow,
  LoenudviklingManuelRow,
} from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

const iso = (value: string) => toISODateString(value);
const amount = (value: number) => ({ kind: 'number' as const, value });

type Employment = ReturnType<typeof createDefaultLoenindkomstAnsaettelsesforhold>;
type SupplementField = 'feriepenge' | 'shSoSats' | 'fritvalg' | 'agPension';

const createSource = (overrides: Partial<Employment> = {}): Employment => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'employment-1',
  ...overrides,
});

const manualRow = (
  id: string,
  overrides: Partial<LoenudviklingManuelRow> = {},
): LoenudviklingManuelRow => ({
  id,
  dato: undefined,
  grundloen: amount(30_000),
  feriepenge: undefined,
  shSoSats: undefined,
  fritvalg: undefined,
  agPension: undefined,
  ...overrides,
});

const percentRow = (
  id: string,
  overrides: Partial<LoenudviklingManuelProcentsatsRow> = {},
): LoenudviklingManuelProcentsatsRow => ({
  id,
  dato: undefined,
  procent: undefined,
  ...overrides,
});

const withSupplement = (
  row: LoenudviklingManuelRow,
  field: SupplementField,
  value: number | undefined,
): LoenudviklingManuelRow => {
  switch (field) {
    case 'feriepenge': return { ...row, feriepenge: value };
    case 'shSoSats': return { ...row, shSoSats: value };
    case 'fritvalg': return { ...row, fritvalg: value };
    case 'agPension': return { ...row, agPension: value };
  }
};

describe('resolveManualRegulationIssue', () => {
  it('peger på samlingsfeltet når manuel angivet ikke har aktive rækker', () => {
    const source = createSource({ loenudviklingManuelTableData: [] });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', true);

    expect(issue?.message).toBe('Manuel regulering mangler: Grundløn');
    expect(issue?.focusTarget).toEqual({
      kind: 'collectionField',
      template: eoEmploymentManual.manualFields.grundloen.template,
    });
  });

  it('peger på den aktive række med manglende grundløn', () => {
    const source = createSource({
      loenudviklingManuelTableData: [
        manualRow('base', { dato: iso('2024-01-01'), grundloen: undefined }),
      ],
    });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', true);

    expect(issue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentManual.manualFields.grundloen.bind('employment-1', 'base').address,
    });
  });

  it('peger på datoen på en efterfølgende aktiv række uden dato', () => {
    const source = createSource({
      loenudviklingManuelTableData: [
        manualRow('base'),
        manualRow('next'),
      ],
    });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', true);

    expect(issue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentManual.manualFields.dato.bind('employment-1', 'next').address,
    });
  });

  it('peger på topfeltet for et manglende basis-ferietillæg i procenttilstand', () => {
    const source = createSource({
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
      loenudviklingManuelTableData: [
        withSupplement(manualRow('base'), 'feriepenge', undefined),
        withSupplement(manualRow('next', { dato: iso('2024-02-01') }), 'feriepenge', 2),
      ],
    });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', true);

    expect(issue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentFields.feriePct.bind('employment-1').address,
    });
  });

  it.each([
    ['feriepenge', eoEmploymentManual.manualFields.feriepenge],
    ['shSoSats', eoEmploymentManual.manualFields.shSoSats],
    ['fritvalg', eoEmploymentManual.manualFields.fritvalg],
    ['agPension', eoEmploymentManual.manualFields.agPension],
  ] as const)('peger på tabelfeltet for manglende %s i beløbstilstand', (field, descriptor) => {
    const source = createSource({
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
      loenudviklingManuelTableData: [
        withSupplement(manualRow('base'), field, 2),
        withSupplement(manualRow('next', { dato: iso('2024-02-01') }), field, undefined),
      ],
    });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', true);

    expect(issue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: descriptor.bind('employment-1', 'next').address,
    });
  });

  it('bruger angivet løns topfelt for manglende ferieprocent', () => {
    const source = createSource({
      loenudviklingManuelTableData: [
        withSupplement(manualRow('base'), 'feriepenge', undefined),
        withSupplement(manualRow('next', { dato: iso('2024-02-01') }), 'feriepenge', 2),
      ],
    });

    const issue = resolveManualRegulationIssue(source, 'Manuelt angivet', false);

    expect(issue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoAngivetLoenFields.feriePct.bind().address,
    });
  });

  it('finder manglende dato og procent i manuel procentsats', () => {
    const missingDate = createSource({
      loenudviklingManuelProcentsatsTableData: [
        percentRow('base', { procent: 0 }),
        percentRow('date-missing', { procent: 2 }),
      ],
    });
    const missingPercent = createSource({
      loenudviklingManuelProcentsatsTableData: [
        percentRow('base', { procent: 0 }),
        percentRow('percent-missing', { dato: iso('2024-02-01') }),
      ],
    });

    const dateIssue = resolveManualRegulationIssue(missingDate, 'Manuel procentsats', true);
    const percentIssue = resolveManualRegulationIssue(missingPercent, 'Manuel procentsats', true);

    expect(dateIssue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentManual.manualPercentFields.dato.bind('employment-1', 'date-missing').address,
    });
    expect(percentIssue?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentManual.manualPercentFields.procent.bind('employment-1', 'percent-missing').address,
    });
  });

  it('ignorerer tom eller komplet manuel procentsats og kan adressere angivet løn', () => {
    const empty = createSource({ loenudviklingManuelProcentsatsTableData: [] });
    const complete = createSource({
      loenudviklingManuelProcentsatsTableData: [
        percentRow('base', { procent: 0 }),
        percentRow('complete', { dato: iso('2024-02-01'), procent: 2 }),
      ],
    });
    const completeManual = createSource({
      loenudviklingManuelTableData: [
        manualRow('base', { feriepenge: 2, shSoSats: 2, fritvalg: 2, agPension: 2 }),
        manualRow('complete', {
          dato: iso('2024-02-01'),
          feriepenge: 2,
          shSoSats: 2,
          fritvalg: 2,
          agPension: 2,
        }),
      ],
    });

    expect(resolveManualRegulationIssue(empty, 'Manuel procentsats', true)).toBeUndefined();
    expect(resolveManualRegulationIssue(complete, 'Manuel procentsats', false)).toBeUndefined();
    expect(resolveManualRegulationIssue(completeManual, 'Manuelt angivet', true)).toBeUndefined();
  });
});
