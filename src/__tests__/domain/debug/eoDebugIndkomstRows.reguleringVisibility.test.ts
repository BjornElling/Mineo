import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
});

describe('buildEoIndkomstRows regulering visibility', () => {
  it('returns only "Valgt regulering" for ansaettelsesforhold when regulering is not selected', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEoIndkomstRows(values, undefined, {});
    const reguleringRowIds = rows.filter((row) => row.id.startsWith(prefix)).map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`]);
  });

  it('returns only "Valgt regulering" when basis is Statistik without valgt model', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = undefined;
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEoIndkomstRows(values, undefined, {});
    const reguleringRowIds = rows.filter((row) => row.id.startsWith(prefix)).map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`]);
  });

  it('returns også "Navn på reguleringsform" når basis er Ingen', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Ingen';
    const prefix = `loenindkomst.${af.id}.regulering.`;

    const rows = buildEoIndkomstRows(values, undefined, {});
    const reguleringRows = rows.filter((row) => row.id.startsWith(prefix));
    const reguleringRowIds = reguleringRows.map((row) => row.id);

    expect(reguleringRowIds).toEqual([`${prefix}valgt`, `${prefix}navn`]);
    expect(reguleringRows.find((row) => row.id === `${prefix}navn`)?.displayValue).toBe('Ingen');
  });
});
