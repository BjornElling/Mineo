import { describe, expect, it } from 'vitest';
import { buildEODebugIndkomstRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold.map((af) => ({
    ...af,
    indtaegtsoplysningerTableData: [...af.indtaegtsoplysningerTableData],
    loenudviklingManuelTableData: [...af.loenudviklingManuelTableData],
  })),
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
});
