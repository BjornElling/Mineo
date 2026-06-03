import {
  buildIndkomstSectionStatuses,
  buildOffentligeYdelserDebugRows,
  isLoenindkomstAnsaettelsesforholdEffectivelyEmpty,
} from '../../../domain/debug/eoDebugIndkomstModel';
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

describe('buildIndkomstSectionStatuses', () => {
  it('giver præcis warning når lønperiode er udfyldt uden beløb', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
      },
    ];

    const result = buildIndkomstSectionStatuses(values, undefined);

    expect(result[0]?.tableStatus).toBe('warning');
    expect(result[0]?.tableMessage).toBe('Lønperiode er udfyldt uden beløb i lønfelterne');
  });

  it('markerer ikke manglende beløb når lønfelt er udfyldt med 0', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col2: amount(0),
      },
    ];

    const result = buildIndkomstSectionStatuses(values, undefined);

    expect(result[0]?.tableStatus).toBe('ok');
    expect(result[0]?.tableMessage).toBe('Ok');
  });

  it('giver præcis fejltekst ved manglende periodefelt', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col2: amount(100),
      },
    ];

    const result = buildIndkomstSectionStatuses(values, undefined);

    expect(result[0]?.tableStatus).toBe('error');
    expect(result[0]?.tableMessage).toBe('År mangler');
  });

  it('giver præcis fejltekst ved ugyldig periodeværdi', () => {
    const { values, af } = buildValuesWithAnsForhold();
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '13',
        col1_maaned: '2024',
      },
    ];

    const result = buildIndkomstSectionStatuses(values, undefined);

    expect(result[0]?.tableStatus).toBe('error');
    expect(result[0]?.tableMessage).toBe('Ugyldig værdi i Måned');
  });

  it('gengiver 0-arbejdsdage-fejl med den specifikke besked', () => {
    const { values, af } = buildValuesWithAnsForhold();
    values.beregnesUdFra = 'Angivet dagsløn';
    af.fuldLoenUnderFerie = 'Nej';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '7',
        col1_maaned: '2024',
        col2: amount(1000),
      },
    ];
    values.ferieperioder = [{ id: 'ferie-1', fra: toISODateString('2024-07-01'), til: toISODateString('2024-07-31') }];

    const result = buildIndkomstSectionStatuses(values, undefined);

    expect(result[0]?.tableStatus).toBe('error');
    expect(result[0]?.tableMessage).toBe(
      buildLoenindkomstZeroArbejdsdageMessage(new Date(Date.UTC(2024, 6, 1)), new Date(Date.UTC(2024, 6, 31)))
    );
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

describe('buildOffentligeYdelserDebugRows', () => {
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

    const result = buildOffentligeYdelserDebugRows(rows);

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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Dato mangler');
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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.label).toBe('Uspecificeret');
    expect(result[0]?.message).toBe('Ydelsestype mangler');
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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ugyldig værdi i Ydelse');
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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('error');
    expect(result[0]?.message).toBe('Ugyldig værdi i Ydelse (2)');
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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('warning');
    expect(result[0]?.message).toBe('Beløb mangler');
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

    const result = buildOffentligeYdelserDebugRows(rows);

    expect(result[0]?.status).toBe('ok');
    expect(result[0]?.message).toBe('Ok');
  });
});
