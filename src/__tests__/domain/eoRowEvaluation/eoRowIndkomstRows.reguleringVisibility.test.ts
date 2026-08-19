import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

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

describe('buildEoIndkomstRows – manuelle reguleringsrækkers udfyldningskrav', () => {
  const asAmount = (value: number) => ({ kind: 'number', value } as const);

  const setupBeregningsperiode = () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    values.tafBeregningsperiodeFra = iso('2023-01-01');
    values.tafBeregningsperiodeTil = iso('2023-12-31');
    const af = values.loenindkomstAnsaettelsesforhold[0];
    return { values, af, prefix: `loenindkomst.${af.id}.regulering.` };
  };

  it('markerer "Alle reguleringsværdier udfyldt" som fejl når en manuel række mangler dato', () => {
    const { values, af, prefix } = setupBeregningsperiode();
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelTableData = [
      { id: 'base', dato: undefined, grundloen: asAmount(30000), feriepenge: undefined, shSoSats: undefined, fritvalg: undefined, agPension: undefined },
      // Grundløn udfyldt men dato mangler → motoren ville droppe rækken stille.
      { id: 'no-date', dato: undefined, grundloen: asAmount(32000), feriepenge: undefined, shSoSats: undefined, fritvalg: undefined, agPension: undefined },
    ];

    const rows = buildEoIndkomstRows(values, undefined, {});
    const alleVaerdier = rows.find((row) => row.id === `${prefix}alleVaerdier`);
    expect(alleVaerdier?.status).toBe('error');
    expect(alleVaerdier?.displayValue).toBe('Nej');
  });

});
