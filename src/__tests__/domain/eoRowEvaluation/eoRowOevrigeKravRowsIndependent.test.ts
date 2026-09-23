import { buildFieldIssueSet, EMPTY_FIELD_ISSUE_SET, type FieldIssue } from '../../../inputCore/inputIssue';
import { toAnyFieldRef, type FieldDescriptor } from '../../../inputCore/fieldDescriptor';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import {
  eoOevrigeKravBeloebField,
  eoOevrigeKravDatoField,
  eoOevrigeKravUdgiftTilField,
} from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import { buildEoOevrigeKravRows } from '../../../domain/eoRowEvaluation/eoRowOevrigeKravRows';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { OevrigeKravRow } from '../../../schemas/formSchemas';

const iso = (value: string) => toISODateString(value);
const amount = (value: number): AmountValue => ({ kind: 'number', value });

const valuesWith = (rows: OevrigeKravRow[]) => {
  const values = createErstatningsopgoerelseInitialValues();
  values.kravPaaOevrigeErstatningskrav = 'Ja';
  values.oevrigeKravPerioder = rows;
  return values;
};

const redIssue = <T,>(field: FieldDescriptor<T>, rowId: string, message: string): FieldIssue =>
  Object.freeze({
    kind: 'field' as const,
    code: `${field.id}.test`,
    severity: 'error' as const,
    field: toAnyFieldRef(field.bind(rowId)),
    reason: 'rule' as const,
    message,
  });

const focusOf = (field: { bind: (rowId: string) => { address: Parameters<typeof serializeFieldAddress>[0] } }, rowId: string) =>
  ({ kind: 'fieldAddress', address: field.bind(rowId).address });

describe('CALC-006 – uafhængigt facit for øvrige kravrækker', () => {
  it('kræver «Udgift til» og «Beløb», men ikke datoen (BB-229)', () => {
    const values = valuesWith([
      { id: 'komplet', dato: iso('2024-02-01'), udgiftTil: 'Behandling', beloeb: amount(1250.5) },
      { id: 'uden-dato', dato: undefined, udgiftTil: 'Transport', beloeb: amount(300) },
      { id: 'uden-beskrivelse', dato: iso('2024-02-02'), udgiftTil: undefined, beloeb: amount(100) },
      { id: 'uden-beloeb', dato: iso('2024-02-03'), udgiftTil: 'Medicin', beloeb: undefined },
      { id: 'tom', dato: undefined, udgiftTil: undefined, beloeb: undefined },
    ]);

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows).toEqual([
      { id: 'oevrigekrav.komplet', label: 'Behandling (01-02-2024)', displayValue: '1.250,50', status: 'ok' },
      { id: 'oevrigekrav.uden-dato', label: 'Transport', displayValue: '300,00', status: 'ok' },
      {
        id: 'oevrigekrav.uden-beskrivelse',
        label: 'Øvrigt erstatningskrav',
        displayValue: 'Fejl (Øvrigt krav (02-02-2024, 100,00 kr.): «Udgift til» er ikke udfyldt)',
        status: 'error',
        message: 'Øvrigt krav (02-02-2024, 100,00 kr.): «Udgift til» er ikke udfyldt',
        summaryDisplay: 'messageOnly',
        focusTarget: focusOf(eoOevrigeKravUdgiftTilField, 'uden-beskrivelse'),
      },
      {
        id: 'oevrigekrav.uden-beloeb',
        label: 'Medicin',
        displayValue: 'Fejl (Medicin: «Beløb» er ikke udfyldt)',
        status: 'error',
        message: 'Medicin: «Beløb» er ikke udfyldt',
        summaryDisplay: 'messageOnly',
        focusTarget: focusOf(eoOevrigeKravBeloebField, 'uden-beloeb'),
      },
    ]);
  });

  it('samler rækkens mangler i én linje og linker til den første celle', () => {
    const rows = buildEoOevrigeKravRows(
      valuesWith([{ id: 'r1', dato: iso('2024-03-15'), udgiftTil: undefined, beloeb: undefined }]),
      EMPTY_FIELD_ISSUE_SET,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.message).toBe('Øvrigt krav (15-03-2024): «Udgift til» og «Beløb» er ikke udfyldt');
    expect(rows[0]?.focusTarget).toEqual(focusOf(eoOevrigeKravUdgiftTilField, 'r1'));
  });

  it('melder en rød celle med sin egen tekst og aldrig som tom (BB-230, BB-232)', () => {
    // Readeren maskerer en rød værdi til tom; rækken ser derfor ud til at mangle dato og beløb.
    const values = valuesWith([{ id: 'r1', dato: undefined, udgiftTil: 'Medicin', beloeb: undefined }]);
    const issues = buildFieldIssueSet([
      redIssue(eoOevrigeKravDatoField, 'r1', 'Datoen findes ikke i kalenderen'),
      redIssue(eoOevrigeKravBeloebField, 'r1', 'Beløbet skal være større end 0 kr.'),
    ]);

    const rows = buildEoOevrigeKravRows(values, issues);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('error');
    expect(rows[0]?.message).toBe('Medicin: Datoen findes ikke i kalenderen; Beløbet skal være større end 0 kr.');
    expect(rows[0]?.focusTarget).toEqual(focusOf(eoOevrigeKravDatoField, 'r1'));
  });

  it('regner en række med kun en rød celle som udfyldt', () => {
    const values = valuesWith([{ id: 'r1', dato: undefined, udgiftTil: undefined, beloeb: undefined }]);
    const issues = buildFieldIssueSet([redIssue(eoOevrigeKravDatoField, 'r1', 'Datoen findes ikke i kalenderen')]);

    const rows = buildEoOevrigeKravRows(values, issues);

    expect(rows.map((row) => row.message)).toEqual([
      'Øvrigt krav: Datoen findes ikke i kalenderen; «Udgift til» og «Beløb» er ikke udfyldt',
    ]);
  });

  it('giver to rækker med samme beskrivelse og mangel hver sin linje (BB-231)', () => {
    const rows = buildEoOevrigeKravRows(
      valuesWith([
        { id: 'a', dato: iso('2024-03-15'), udgiftTil: 'Medicin', beloeb: undefined },
        { id: 'b', dato: iso('2024-04-15'), udgiftTil: 'Medicin', beloeb: undefined },
        { id: 'c', dato: iso('2024-04-16'), udgiftTil: 'Transport', beloeb: undefined },
      ]),
      EMPTY_FIELD_ISSUE_SET,
    );

    expect(rows.map((row) => row.message)).toEqual([
      'Medicin (15-03-2024): «Beløb» er ikke udfyldt',
      'Medicin (15-04-2024): «Beløb» er ikke udfyldt',
      'Transport: «Beløb» er ikke udfyldt',
    ]);
  });

  it('advarer uden at blokere, når datoen ligger uden for opgørelsens periode (BB-235)', () => {
    const values = valuesWith([
      { id: 'foer', dato: iso('2019-06-15'), udgiftTil: 'Medicin', beloeb: amount(100) },
      { id: 'i', dato: iso('2024-06-15'), udgiftTil: 'Briller', beloeb: amount(200) },
      { id: 'efter', dato: iso('2025-01-15'), udgiftTil: 'Transport', beloeb: amount(300) },
    ]);
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows.map((row) => [row.status, row.message])).toEqual([
      ['warning', 'Medicin: Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-12-2024)'],
      ['ok', undefined],
      ['warning', 'Transport: Datoen ligger uden for opgørelsens periode (01-01-2024 - 31-12-2024)'],
    ]);
    expect(rows[0]?.focusTarget).toEqual(focusOf(eoOevrigeKravDatoField, 'foer'));
  });

  it('lader en fejl i rækken gå forud for periodeadvarslen, så rækken giver én linje', () => {
    const values = valuesWith([{ id: 'r1', dato: iso('2019-06-15'), udgiftTil: 'Medicin', beloeb: undefined }]);
    values.vedroererPeriodeFra = iso('2024-01-01');
    values.vedroererPeriodeTil = iso('2024-12-31');

    const rows = buildEoOevrigeKravRows(values, EMPTY_FIELD_ISSUE_SET);

    expect(rows.map((row) => [row.status, row.message])).toEqual([['error', 'Medicin: «Beløb» er ikke udfyldt']]);
  });

  it('advarer, når kravvalget er «Ja», men tabellen er tom (BB-236)', () => {
    const rows = buildEoOevrigeKravRows(valuesWith([]), EMPTY_FIELD_ISSUE_SET);

    expect(rows).toEqual([
      {
        id: 'oevrigekrav.empty',
        label: 'Ingen',
        displayValue: '-',
        status: 'warning',
        message: 'Der er ikke indtastet øvrige krav',
        summaryDisplay: 'messageOnly',
        focusTarget: { kind: 'collectionField', template: eoOevrigeKravUdgiftTilField.template },
      },
    ]);
  });
});
