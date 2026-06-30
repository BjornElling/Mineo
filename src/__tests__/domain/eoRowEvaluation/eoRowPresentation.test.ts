import { resolveEoRowPresentation } from '../../../domain/eoRowEvaluation/eoRowPresentation';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';

describe('resolveEoRowPresentation', () => {
  it('extracts structured message from Fejl (...) as default fallback', () => {
    const presentation = resolveEoRowPresentation({
      id: 'test.error',
      label: 'Test',
      status: 'error',
      displayValue: 'Fejl (Mangler dato)',
    });

    expect(presentation.message).toBe('Mangler dato');
    expect(presentation.summaryDisplay).toBe('default');
  });

  it('keeps default summary and empty message for unknown id with plain value', () => {
    const presentation = resolveEoRowPresentation({
      id: 'debug.unknown.row',
      label: 'Ukendt',
      status: 'warning',
      displayValue: '-',
    });

    expect(presentation.message).toBeUndefined();
    expect(presentation.summaryDisplay).toBe('default');
  });

  it('uses messageOnly summary for taf.beregningsgrundlag.indkomst', () => {
    const presentation = resolveEoRowPresentation({
      id: 'taf.beregningsgrundlag.indkomst',
      label: 'Indkomst',
      status: 'error',
      displayValue: '-',
      message: 'Ingen indkomst i beregningsperioden (01-01-2025 - 31-01-2025)',
    });

    expect(presentation.message).toBe('Ingen indkomst i beregningsperioden (01-01-2025 - 31-01-2025)');
    expect(presentation.summaryDisplay).toBe('messageOnly');
  });

  it('viser TAF-ophør-advarsel uden label-prefiks i summary', () => {
    const presentation = resolveEoRowPresentation({
      id: 'taf.ophoerSkyldes',
      label: 'TAF-ophør skyldes',
      status: 'warning',
      displayValue: 'Der er ikke rejst TAF-krav for hele EO-perioden',
    });

    expect(presentation.summaryText).toBe('Der er ikke rejst TAF-krav for hele EO-perioden');
    expect(presentation.summaryDisplay).toBe('messageOnly');
  });
});

describe('manual regulering message', () => {
  it('sets explicit manual-regulering message on alleVaerdier error row', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [],
      },
    ];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    const rows = buildEoIndkomstRows(values, undefined, {});
    const row = rows.find((r) => r.id === `loenindkomst.${af.id}.regulering.alleVaerdier`);

    expect(row).toBeDefined();
    expect(row?.status).toBe('error');
    expect(row?.message).toBe('Værdier mangler at blive udfyldt for manuel regulering');
    expect(row?.summaryDisplay).toBe('messageOnly');
  });

  it('bruger messageOnly for lønoplysninger-række i beregningens summary', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
      },
    ];

    const rows = buildEoIndkomstRows(values, undefined, {});
    const row = rows.find((r) => r.id === `loenindkomst.${af.id}.loenoplysninger`);

    expect(row).toBeDefined();
    expect(row?.status).toBe('warning');
    expect(row?.summaryDisplay).toBe('messageOnly');
  });
});
