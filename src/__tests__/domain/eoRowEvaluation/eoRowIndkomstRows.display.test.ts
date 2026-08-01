import { buildEoIndkomstRows } from '../../../domain/eoRowEvaluation/eoRowIndkomstRows';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const amount = (value: number): AmountValue => ({ kind: 'number', value });

const cloneInitialValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  loenindkomstAnsaettelsesforhold: [createDefaultLoenindkomstAnsaettelsesforhold()],
});

describe('buildEoIndkomstRows display', () => {
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

    const rows = buildEoIndkomstRows(values, undefined, {});
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
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, undefined, {});
    const nameRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.navn`);

    expect(nameRow).toBeDefined();
    expect(nameRow?.status).toBe('ok');
    expect(nameRow?.displayValue).toBe('Manuelt angivet (DA-tillægstrin)');
  });

  it('viser anmeldelsesdatoen som satsreference ved erhvervssygdom', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];

    const rows = buildEoIndkomstRows(values, toISODateString('2024-06-01'), {}, undefined, 'Erhvervssygdom');
    const satserRow = rows.find((row) => row.id === `loenindkomst.${af.id}.satserSkadestidspunkt`);

    expect(satserRow?.label).toBe('Satser på anmeldelsesdatoen');
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
        dato: toISODateString('2024-01-01'),
        grundloen: amount(100),
        feriepenge: undefined,
        shSoSats: undefined,
        fritvalg: undefined,
        agPension: undefined,
      },
    ];

    const rows = buildEoIndkomstRows(values, undefined, {});
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

    const rows = buildEoIndkomstRows(values, undefined, {});
    const offentligRow = rows.find((row) => row.id === `loenindkomst.${af.id}.regulering.offentligLoenoplysninger`);

    expect(offentligRow?.displayValue).toBe('Timeløn, løntrin 26, gruppe 2');
    expect(offentligRow?.status).toBe('ok');
  });

  it('viser advarsel når lønperiode løber efter sidste arbejdsdag', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.loenperiode = 'dag';
    af.ansaettelsesforholdOphoert = true;
    af.sidsteArbejdsdag = toISODateString('2024-03-15');
    af.indtaegtsoplysningerTableData = [
      {
        id: 'row-1',
        col0_dag: toISODateString('2024-03-01'),
        col1_dag: toISODateString('2024-03-31'),
        col2: amount(1000),
      },
    ];

    const rows = buildEoIndkomstRows(values, undefined, {});
    const warningRow = rows.find((row) => row.id === `loenindkomst.${af.id}.loenEfterOphoer`);

    expect(warningRow?.status).toBe('warning');
    expect(warningRow?.displayValue).toContain('15-03-2024');
  });

  it('viser en navigerbar advarsel når opsagt ansættelse mangler sidste arbejdsdag', () => {
    const values = cloneInitialValues();
    const af = values.loenindkomstAnsaettelsesforhold[0];
    af.ansaettelsesforholdOphoert = true;
    af.sidsteArbejdsdag = undefined;

    const rows = buildEoIndkomstRows(values, undefined, {});
    const warningRow = rows.find((row) => row.id === `loenindkomst.${af.id}.sidsteArbejdsdagMangler`);

    expect(warningRow).toMatchObject({
      status: 'warning',
      summaryDisplay: 'messageOnly',
      summaryText: 'Det angives, at skadelidte er opsagt, men sidste arbejdsdag er ikke indtastet',
      focusTarget: {
        kind: 'fieldAddress',
        address: expect.objectContaining({
          field: 'sidsteArbejdsdag',
          path: [expect.objectContaining({ entityId: af.id })],
        }),
      },
    });
  });
});
