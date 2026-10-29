import {
  buildOffentligeYdelserStatusRows,
  isLoenindkomstAnsaettelsesforholdEffectivelyEmpty,
} from '../../../domain/eoRowEvaluation/eoRowIndkomstModel';
import { buildLoenindkomstTableLines } from '../../../domain/eoRowEvaluation/eoRowLoenindkomstTableLines';
import { createEoStandardLoenFieldSet } from '../../../domain/erstatningsopgoerelse/eoStandardLoenFieldSet';
import { bindCollectionCell } from '../../../inputCore/collectionCellBinding';
import { toAnyFieldRef } from '../../../inputCore/fieldDescriptor';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildLoenindkomstZeroArbejdsdageMessage } from '../../../domain/erstatningsopgoerelse/validation/indkomstRowValidation';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });
const createEmployment = (overrides: Record<string, unknown> = {}) => ({
  ...createDefaultLoenindkomstAnsaettelsesforhold(),
  id: 'af-1',
  ...overrides,
});

const buildValuesWithAnsForhold = () => {
  const values = createErstatningsopgoerelseInitialValues();
  const af = createEmployment();
  values.loenindkomstAnsaettelsesforhold = [af];
  return { values, af };
};

const TODAY = toISODateString('2026-10-19');

describe('buildLoenindkomstTableLines', () => {
  const linesFor = (values: ReturnType<typeof createErstatningsopgoerelseInitialValues>) =>
    buildLoenindkomstTableLines(values, values.loenindkomstAnsaettelsesforhold[0]!, [], undefined, TODAY);

  it('giver en gul linje, der navngiver rækken, når lønperioden er udfyldt uden beløb', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [{ id: 'row-1', col0_maaned: '1', col1_maaned: '2024' }];

    expect(linesFor(values)).toEqual([expect.objectContaining({
      status: 'warning',
      message: 'Lønrækken 01-2024 er udfyldt uden beløb',
    })]);
  });

  it('markerer ikke manglende beløb når lønfelt er udfyldt med 0', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [{ id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col2: amount(0) }];

    expect(linesFor(values)).toEqual([]);
  });

  it('navngiver den manglende celle og rækkens plads, når perioden ikke er hel (BB-291)', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      { id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col2: amount(100) },
      { id: 'row-2', col0_maaned: '2', col2: amount(100) },
    ];

    expect(linesFor(values)).toEqual([expect.objectContaining({
      key: 'row-2.fejl',
      status: 'error',
      message: 'Række 2: År er ikke angivet',
    })]);
  });

  it('giver én linje pr. fejlbehæftet række – ikke kun den første (BB-291)', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      { id: 'row-1', col1_maaned: '2024', col2: amount(100) },
      { id: 'row-2', col0_maaned: '2', col2: amount(100) },
    ];

    expect(linesFor(values).map((line) => line.message)).toEqual([
      'Række 1: Måned er ikke angivet',
      'Række 2: År er ikke angivet',
    ]);
  });

  it('bruger cellens egen tekst for en rød celle og siger ikke «ikke angivet» om den (BB-291)', () => {
    const { values, af } = buildValuesWithAnsForhold();
    // Readeren læser en rød celle som tom; issuet bærer cellens egen tekst og adresse.
    af.indtaegtsoplysningerTableData = [{ id: 'row-1', col1_maaned: '2024', col2: amount(100) }];
    const fieldSet = createEoStandardLoenFieldSet('af-1');
    const field = toAnyFieldRef(bindCollectionCell(fieldSet.collection, fieldSet.col0_maaned, 'row-1'));
    const issue: FieldIssue = {
      kind: 'field',
      code: 'maaned.bounds',
      severity: 'error',
      field,
      reason: 'bounds',
      message: 'Værdi skal være mellem 1 og 12',
    };

    const lines = buildLoenindkomstTableLines(values, af, [issue], undefined, TODAY);

    expect(lines).toEqual([expect.objectContaining({
      status: 'error',
      message: 'Række 1: Måned – Værdi skal være mellem 1 og 12',
      focusAddress: field.address,
    })]);
  });

  it('gengiver 0-arbejdsdage som en ikke-blokerende advarsel (ikke fejl)', () => {
    const { values, af } = buildValuesWithAnsForhold();
    values.beregnesUdFra = 'Angivet dagsløn';
    af.fuldLoenUnderFerie = 'Nej';
    af.indtaegtsoplysningerTableData = [{ id: 'row-1', col0_maaned: '7', col1_maaned: '2024', col2: amount(1000) }];
    values.ferieperioder = [{ id: 'ferie-1', fra: toISODateString('2024-07-01'), til: toISODateString('2024-07-31') }];
    // TAF-afsnittets ferie gælder kun i TAF-perioderne (`resolveIndkomstFerieperioder`).
    values.tafPerioder = [{ id: 'taf-1', fra: toISODateString('2024-07-01'), til: toISODateString('2024-07-31'), loseFeriedage: undefined }];

    // Situationen er ikke en fejl: lønnen medregnes via fald-tilbage-fordeling, download må ikke spærres.
    expect(linesFor(values)).toEqual([expect.objectContaining({
      status: 'warning',
      message: buildLoenindkomstZeroArbejdsdageMessage(new Date(Date.UTC(2024, 6, 1)), new Date(Date.UTC(2024, 6, 31))),
    })]);
  });

  it('lader ægte ugyldigt input have forrang over 0-arbejdsdage-advarslen (blokerer)', () => {
    const { values, af } = buildValuesWithAnsForhold();
    values.beregnesUdFra = 'Angivet dagsløn';
    af.fuldLoenUnderFerie = 'Nej';
    af.indtaegtsoplysningerTableData = [{ id: 'row-1', col0_maaned: '13', col1_maaned: '2024', col2: amount(1000) }];
    values.ferieperioder = [{ id: 'ferie-1', fra: toISODateString('2024-07-01'), til: toISODateString('2024-07-31') }];

    expect(linesFor(values).map((line) => line.status)).toEqual(['error']);
  });
});

describe('isLoenindkomstAnsaettelsesforholdEffectivelyEmpty', () => {
  it('returnerer true for det initiale tomme ansættelsesforhold', () => {
    const { af } = buildValuesWithAnsForhold();

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af)).toBe(true);
  });

  it('returnerer true for load-normaliseret tomt ansættelsesforhold med beregningsgrundlag=Ingen', () => {
    const { af } = buildValuesWithAnsForhold();
    af.loenudviklingBeregningsgrundlag = 'Ingen';

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af)).toBe(true);
  });

  it('returnerer false når der er indtastet lønoplysninger', () => {
    const { af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col2: amount(1000),
      },
    ];

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af)).toBe(false);
  });

  it('returnerer false når reguleringsgrundlag er valgt til andet end Ingen', () => {
    const { af } = buildValuesWithAnsForhold();
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af)).toBe(false);
  });

  it('returnerer false når overenskomstfilter afviger fra default', () => {
    const { af } = buildValuesWithAnsForhold();
    af.overenskomstFilter = {
      loenmodtager: '3F',
      arbejdsgiver: undefined,
    };

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af)).toBe(false);
  });

  it('returnerer true når ansættelsesforholdet kun indeholder app-settings-defaults', () => {
    const settings = {
      ...DEFAULT_APP_SETTINGS,
      defaultFuldLoenUnderFerie: false,
      defaultLoenPaaHelligdage: 'SH-udbetaling' as const,
      defaultOverenskomstLoenmodtager: '3F',
      defaultOverenskomstArbejdsgiver: 'DI',
    };
    const af = createEmployment({
      fuldLoenUnderFerie: 'Nej',
      loenPaaHelligdage: 'SH-udbetaling',
      overenskomstFilter: { loenmodtager: '3F', arbejdsgiver: 'DI' },
    });

    expect(isLoenindkomstAnsaettelsesforholdEffectivelyEmpty(af, settings)).toBe(true);
  });
});

describe('buildOffentligeYdelserStatusRows', () => {
  it('viser "Ok" ved korrekt udfyldt offentlig ydelse i stedet for beregnet sum', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('ok');
    expect(result[0]?.message).toBe('Ok');
  });

  it('giver fejlteksten "Dato mangler" når dato ikke er fuldt udfyldt', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: undefined,
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ydelsen Dagpenge 31-01-2024: Dato er ikke angivet');
    expect(result[0]?.focusColKey).toBe('fraDato');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('viser Uspecificeret og fejlteksten "Ydelsestype mangler" når ydelsestype mangler', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: '',
        ydelse: amount(1200),
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.label).toBe('Uspecificeret');
    expect(result[0]?.message).toBe('Ydelsen 01-01-2024 - 31-01-2024: Ydelsestype er ikke valgt');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('giver præcis fejltekst ved ugyldig beløbsværdi', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
        ydelse: { kind: 'expression' as const, value: 100, expression: '' },
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ydelsen Dagpenge 01-01-2024 - 31-01-2024: Ydelse – ugyldig værdi');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('giver præcis fejltekst ved ugyldig værdi i det andet ydelsesfelt', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
        ydelse: undefined,
        tillaeg: { kind: 'expression' as const, value: 100, expression: '' },
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ydelsen Dagpenge 01-01-2024 - 31-01-2024: Tillæg – ugyldig værdi');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('giver warningteksten "Beløb mangler" ved periode uden beløb', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('warning');
    expect(result[0]?.message).toBe('Ydelsen Dagpenge 01-01-2024 - 31-01-2024: Beløb er ikke angivet');
    expect(result[0]?.summaryDisplay).toBe('messageOnly');
  });

  it('behandler 0 som gyldigt beløb', () => {
    const rows = [
      {
        id: 'row-1',
        fraDato: toISODateString('2024-01-01'),
        tilDato: toISODateString('2024-01-31'),
        ydelsestype: 'dagpenge',
        ydelse: amount(0),
      },
    ];

    const result = buildOffentligeYdelserStatusRows(rows);

    expect(result[0]?.status).toBe('ok');
    expect(result[0]?.message).toBe('Ok');
  });
});
