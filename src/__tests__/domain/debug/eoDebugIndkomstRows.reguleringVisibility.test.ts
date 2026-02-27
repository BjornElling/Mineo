import { describe, expect, it } from 'vitest';
import { buildEODebugIndkomstRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold.map((af) => ({
    ...af,
    indtaegtsoplysningerTableData: [...af.indtaegtsoplysningerTableData],
    loenudviklingManuelTableData: [...af.loenudviklingManuelTableData],
  })),
});

describe('buildEODebugIndkomstRows regulering visibility', () => {
  it('returns only "Valgt regulering" for ansaettelsesforhold when regulering is not selected', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const reguleringRowIds = rows.filter((row) => row.id.startsWith(prefix)).map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`]);
  });

  it('returns only "Valgt regulering" when basis is Statistik without valgt model', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = undefined;
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const reguleringRowIds = rows.filter((row) => row.id.startsWith(prefix)).map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`]);
  });

  it('returns only "Valgt regulering" when basis is Ingen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Ingen';
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const reguleringRowIds = rows.filter((row) => row.id.startsWith(prefix)).map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`]);
  });
});
