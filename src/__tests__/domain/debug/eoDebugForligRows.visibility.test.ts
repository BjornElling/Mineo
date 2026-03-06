import { describe, expect, it } from 'vitest';
import { buildEODebugForligRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

describe('buildEODebugForligRows visibility', () => {
  it('viser kun den samlede forligsrække med bindestreg når ingen værdi er udfyldt', () => {
    const rows = buildEODebugForligRows(createErstatningsopgoerelseInitialValues(), {});

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      displayValue: '-',
      status: 'ok',
    });
  });

  it('viser samlet forligsrække samt afledte rækker når kun procent er udfyldt', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.forligAnsvarsgradProcent = 50;
    values.forligDato = '2024-01-31';

    const rows = buildEODebugForligRows(values, {});

    expect(rows.map((row) => row.id)).toEqual([
      'forlig.ansvarsgrad',
      'forlig.beregnetAnsvarsgrad',
      'forlig.dato',
    ]);
    expect(rows[0]).toMatchObject({
      label: 'Forlig om ansvarsgrad',
      displayValue: '50%',
      status: 'ok',
    });
    expect(rows[1]).toMatchObject({
      label: 'Beregnet ansvarsgrad',
      displayValue: '50%',
      status: 'ok',
    });
    expect(rows[2]).toMatchObject({
      label: 'Evt. dato for forlig',
      displayValue: '31-01-2024',
      status: 'ok',
    });
  });

  it('viser samlet forligsrække samt afledte rækker når kun brøk er udfyldt', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.forligAnsvarsgradBroek = '1/3';

    const rows = buildEODebugForligRows(values, {});

    expect(rows.map((row) => row.id)).toEqual([
      'forlig.ansvarsgrad',
      'forlig.beregnetAnsvarsgrad',
      'forlig.dato',
    ]);
    expect(rows[0]?.displayValue).toBe('1/3');
    expect(rows[1]?.displayValue).toBe('33,33%');
    expect(rows[2]?.displayValue).toBe('-');
  });

  it('viser kun samlet fejl-række når både procent og brøk er udfyldt', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.forligAnsvarsgradProcent = 50;
    values.forligAnsvarsgradBroek = '1/3';
    values.forligDato = '2024-01-31';

    const rows = buildEODebugForligRows(values, {
      forligAnsvarsgradProcent: {
        rule: {
          source: 'rule',
          severity: 'error',
          message: 'Angiv enten procent eller brøk – ikke begge',
        },
      },
      forligAnsvarsgradBroek: {
        rule: {
          source: 'rule',
          severity: 'error',
          message: 'Angiv enten procent eller brøk – ikke begge',
        },
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      status: 'error',
      summaryDisplay: 'messageOnly',
    });
    expect(rows[0]?.displayValue).toContain('Angiv enten procent eller brøk');
  });
});
