import { EMPTY_FIELD_ISSUE_SET } from '../../../inputCore/inputIssue';
import { buildEoOevrigeKravRows } from '../../../domain/eoRowEvaluation/eoRowOevrigeKravRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('CALC-006 – uafhængigt facit for øvrige kravrækker', () => {
  it('viser komplet, delvist udfyldt og tom række med korrekt status og beløbsfacit', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.oevrigeKravPerioder = [
      {
        id: 'komplet',
        dato: iso('2024-02-01'),
        udgiftTil: 'Behandling',
        beloeb: amount(1250.5),
      },
      {
        id: 'uden-dato',
        dato: undefined,
        udgiftTil: 'Transport',
        beloeb: amount(300),
      },
      {
        id: 'uden-beskrivelse',
        dato: iso('2024-02-02'),
        udgiftTil: undefined,
        beloeb: amount(100),
      },
      {
        id: 'uden-beloeb',
        dato: iso('2024-02-03'),
        udgiftTil: 'Medicin',
        beloeb: undefined,
      },
      {
        id: 'tom',
        dato: undefined,
        udgiftTil: undefined,
        beloeb: undefined,
      },
    ];

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows).toEqual([
      {
        id: 'oevrigekrav.komplet',
        label: 'Behandling (01-02-2024)',
        displayValue: '1.250,50',
        status: 'ok',
      },
      {
        id: 'oevrigekrav.uden-dato',
        label: 'Transport',
        displayValue: '300,00',
        status: 'warning',
        message: 'Dato er ikke angivet',
        summaryDisplay: 'messageOnly',
      },
      {
        id: 'oevrigekrav.uden-beskrivelse',
        label: 'Øvrigt erstatningskrav',
        displayValue: 'Fejl (Beskrivelse er ikke udfyldt)',
        status: 'error',
        message: 'Beskrivelse er ikke udfyldt',
        summaryDisplay: 'messageOnly',
      },
      {
        id: 'oevrigekrav.uden-beloeb',
        label: 'Medicin',
        displayValue: 'Fejl (Beløb er ikke angivet)',
        status: 'error',
        message: 'Beløb er ikke angivet',
        summaryDisplay: 'messageOnly',
      },
    ]);
  });
});
