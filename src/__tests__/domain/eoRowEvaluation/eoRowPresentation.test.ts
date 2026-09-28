import { resolveEoRowPresentation } from '../../../domain/eoRowEvaluation/eoRowPresentation';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import {
  eoEmploymentFields,
  eoEmploymentManual,
} from '../../../inputCore/catalog/erstatningsopgoerelseLoenDescriptors';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

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
    expect(row?.message).toBe('Manuel regulering mangler: Grundløn');
    expect(row?.summaryDisplay).toBe('messageOnly');
    expect(row?.focusTarget).toEqual({
      kind: 'collectionField',
      template: expect.objectContaining({ field: 'grundloen' }),
    });
  });

  it('peger på pensionsfeltet over tabellen når basissatsen mangler', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [
          {
            id: 'base',
            dato: undefined,
            grundloen: amount(100),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            id: 'row-2',
            dato: toISODateString('2024-02-01'),
            grundloen: amount(110),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: 10,
          },
        ],
      },
    ];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    const row = buildEoIndkomstRows(values, undefined, {}).find(
      (candidate) => candidate.id === `loenindkomst.${af.id}.regulering.alleVaerdier`
    );

    expect(row?.message).toBe('Manuel regulering mangler: Arbejdsgivers pensionsbidrag');
    expect(row?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentFields.pensionPct.bind(af.id).address,
    });
  });

  it('peger på den manglende procentsats i manuel procentsats-tabellen', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.loenindkomstAnsaettelsesforhold = [
      {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        loenudviklingBeregningsgrundlag: 'Manuel procentsats',
        loenudviklingManuelProcentsatsTableData: [
          { id: 'base', dato: undefined, procent: 0 },
          { id: 'row-2', dato: toISODateString('2024-02-01'), procent: undefined },
        ],
      },
    ];

    const af = values.loenindkomstAnsaettelsesforhold[0];
    const row = buildEoIndkomstRows(values, undefined, {}).find(
      (candidate) => candidate.id === `loenindkomst.${af.id}.regulering.alleVaerdier`
    );

    expect(row?.message).toBe('Manuel regulering mangler: Procent');
    expect(row?.focusTarget).toEqual({
      kind: 'fieldAddress',
      address: eoEmploymentManual.manualPercentFields.procent.bind(af.id, 'row-2').address,
    });
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
