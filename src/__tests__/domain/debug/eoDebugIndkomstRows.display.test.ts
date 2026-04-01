import { buildEODebugIndkomstRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
});

describe('buildEODebugIndkomstRows display', () => {
  it('viser Ja for satser, lønoplysninger og valgt regulering når data er korrekt udfyldt', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.navnPaaArbejdssted = 'Arbejdssted A';
    af.overenskomstId = '3f-industriens-funktionaeroverenskomst';
    af.loenudviklingBeregningsgrundlag = 'Statistik';
    af.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col2: amount(1000),
      },
    ];

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const prefix = `loenindkomst.${af.id}`;

    expect(rows.find((row) => row.id === `${prefix}.satserSkadestidspunkt`)?.displayValue).toBe('Ja');
    expect(rows.find((row) => row.id === `${prefix}.loenoplysninger`)?.displayValue).toBe('Ja');
    expect(rows.find((row) => row.id === `${prefix}.regulering.valgt`)?.displayValue).toBe('Ja');
  });

  it('viser navn på reguleringsform for manuel regulering', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelNavn = 'DA-tillægstrin';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: '01-01-2024',
        grundloen: 100,
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
    ];

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const nameRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.navn`);

    expect(nameRow).toBeDefined();
    expect(nameRow?.status).toBe('ok');
    expect(nameRow?.displayValue).toBe('Manuelt angivet (DA-tillægstrin)');
  });

  it('falder tilbage til grundlaget når manuel reguleringsform ikke har eget navn', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    af.loenudviklingManuelNavn = '   ';
    af.loenudviklingManuelTableData = [
      {
        ...af.loenudviklingManuelTableData[0],
        dato: '01-01-2024',
        grundloen: 100,
        feriepenge: '',
        shSoSats: '',
        fritvalg: '',
        agPension: '',
      },
    ];

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const nameRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.navn`);

    expect(nameRow?.displayValue).toBe('Manuelt angivet');
    expect(nameRow?.status).toBe('ok');
  });

  it('viser løntrin og gruppe med eksplicitte etiketter for KL-/RLTN-oplysninger', () => {
    const values = cloneInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.navnPaaArbejdssted = 'Arbejdssted A';
    af.loenudviklingBeregningsgrundlag = 'Overenskomst';
    af.overenskomstId = 'kl-overenskomst';
    af.offentligLoenType = 'Timeløn';
    af.offentligLoenTrin = 26;
    af.offentligLoenGruppe = 2;
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_maaned: '1',
        col1_maaned: '2024',
        col2: amount(1000),
      },
    ];

    const rows = buildEODebugIndkomstRows(values, undefined, {});
    const offentligRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.offentligLoenoplysninger`);

    expect(offentligRow?.displayValue).toBe('Timeløn, løntrin 26, gruppe 2');
    expect(offentligRow?.status).toBe('ok');
  });
});
