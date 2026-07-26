import { buildEoForligRows } from '../../../domain/eoRowEvaluation/eoRowErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

describe('buildEoForligRows visibility', () => {
  it('viser kun den samlede forligsrække med bindestreg når ingen værdi er udfyldt', () => {
    const rows = buildEoForligRows(createErstatningsopgoerelseInitialValues(), {});

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
    values.forligDato = toISODateString('2024-01-31');

    const rows = buildEoForligRows(values, {});

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
      displayValue: '50 %',
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

    const rows = buildEoForligRows(values, {});

    expect(rows.map((row) => row.id)).toEqual([
      'forlig.ansvarsgrad',
      'forlig.beregnetAnsvarsgrad',
      'forlig.dato',
    ]);
    expect(rows[0]?.displayValue).toBe('1/3');
    expect(rows[1]?.displayValue).toBe('33,33 %');
    expect(rows[2]?.displayValue).toBe('-');
  });

  it('viser samlet fejl-række samt datolinje når både procent og brøk er udfyldt og dato findes', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.forligAnsvarsgradProcent = 50;
    values.forligAnsvarsgradBroek = '1/3';
    values.forligDato = toISODateString('2024-01-31');

    const rows = buildEoForligRows(values, {
      forligAnsvarsgradProcent: { reason: 'rule',
          severity: 'error',
          message: 'Angiv enten procent eller brøk – ikke begge',
        
      },
      forligAnsvarsgradBroek: { reason: 'rule',
          severity: 'error',
          message: 'Angiv enten procent eller brøk – ikke begge',
        
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      status: 'error',
      summaryDisplay: 'messageOnly',
    });
    expect(rows[0]?.displayValue).toContain('Angiv enten procent eller brøk');
    expect(rows[1]).toMatchObject({
      id: 'forlig.dato',
      label: 'Evt. dato for forlig',
      displayValue: '31-01-2024',
      status: 'ok',
    });
  });

  it('viser blokerende fejl-række når procent-feltet har en rød, ikke-committbar værdi', () => {
    // Invarianten: et rødt felt (rød ring) eksponeres som en blokerende feltissue.
    // buildEoForligRows skal derfor lave en error-række, så den vises i
    // EOberegning-boksen (med link) og gater download — også selvom ingen værdi er committet.
    const values = createErstatningsopgoerelseInitialValues();

    const rows = buildEoForligRows(values, {
      forligAnsvarsgradProcent: { reason: 'rule',
          severity: 'error',
          message: 'Ugyldig værdi: "0"',
        
      },
    });

    expect(rows[0]).toMatchObject({
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      status: 'error',
    });
    expect(rows[0]?.displayValue).toContain('Ugyldig værdi');
  });

  it('viser fejl på forligsdato når dato er udfyldt uden ansvarsgrad', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.forligDato = toISODateString('2024-01-31');

    const rows = buildEoForligRows(values, {
      forligDato: { reason: 'rule',
          severity: 'error',
          message: 'Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk',
        
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'forlig.ansvarsgrad',
      label: 'Forlig om ansvarsgrad',
      displayValue: '-',
      status: 'ok',
    });
    expect(rows[1]).toMatchObject({
      id: 'forlig.dato',
      label: 'Evt. dato for forlig',
      displayValue: 'Fejl (Dato for forlig kræver, at ansvarsgrad angives som procent eller brøk)',
      status: 'error',
    });
  });
});
