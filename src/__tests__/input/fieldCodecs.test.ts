import {
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createSelectionFieldCodec,
  booleanFieldCodec,
  createDateFieldCodec,
  createFractionFieldCodec,
  createIntegerFieldCodec,
  createPercentFieldCodec,
  createTextFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../../input/fieldCodecs';

describe('fieldCodecs', () => {
  it('deler canonical parsing og formatering for de numeriske inputfamilier', () => {
    const amount = createAmountFieldCodec({ allowNegative: false });
    const percent = createPercentFieldCodec({ allowNegative: false, allowDecimals: true });
    const integer = createIntegerFieldCodec({ allowNegative: false, maxDigits: 3 });

    expect(amount.parseForSettle('1.250,50')).toEqual({
      status: 'valid', value: { kind: 'number', value: 1250.5 },
    });
    expect(amount.parseForSettle('-1')).toEqual({ status: 'invalid' });
    expect(percent.parseForSettle('12,5')).toEqual({ status: 'valid', value: 12.5 });
    expect(percent.parseForSettle('12,555')).toEqual({ status: 'invalid' });
    expect(integer.parseForSettle('042')).toEqual({ status: 'valid', value: 42 });
    expect(integer.parseForSettle('1,5')).toEqual({ status: 'invalid' });
  });

  it('bevarer eksisterende settle-semantik for dato, år, uge og brøk', () => {
    const date = createDateFieldCodec({ twoDigitYearPolicy: 'assume20xx' });
    const year = createYearFieldCodec({ twoDigitYearPolicy: 'reject', minYear: 2000, maxYear: 2100 });
    const week = createWeekFieldCodec({
      twoDigitYearPolicy: 'assume20xx', minYear: 2000, maxYear: 2100, maxDraftLength: 8,
    });
    const fraction = createFractionFieldCodec({ canonicalizeOnCommit: true });

    expect(date.parseForSettle('1-2-24')).toEqual({ status: 'valid', value: '2024-02-01' });
    expect(date.parseForSettle('31-02-2024')).toEqual({ status: 'invalid' });
    expect(year.parseForSettle('24')).toEqual({ status: 'invalid' });
    expect(week.parseForSettle('3/24')).toEqual({ status: 'valid', value: '03/2024' });
    expect(fraction.parseForSettle('2/4')).toEqual({ status: 'valid', value: '1/2' });
  });

  it('lader tekstfeltets trimning være et eksplicit codec-valg', () => {
    expect(createTextFieldCodec().parseForSettle('  Mineo  ')).toEqual({ status: 'valid', value: '  Mineo  ' });
    expect(createTextFieldCodec({ trim: true }).parseForSettle('  Mineo  ')).toEqual({ status: 'valid', value: 'Mineo' });
  });

  it('accepterer kun et controls udtrykkeligt registrerede valg', () => {
    const choice = createChoiceFieldCodec(['Ja', 'Nej'] as const);

    expect(choice.parseForSettle('Ja')).toEqual({ status: 'valid', value: 'Ja' });
    expect(choice.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
    expect(choice.parseForSettle('Måske')).toEqual({ status: 'invalid' });
    expect(() => createChoiceFieldCodec([])).toThrow('ChoiceFieldCodec: valgmængden skal være ikke-tom og uden dubletter');
  });

  it('bevarer typen for dropdown-tal og toggles', () => {
    const selection = createSelectionFieldCodec({ values: [12, 24] as const });

    expect(selection.parseForSettle('24')).toEqual({ status: 'valid', value: 24 });
    expect(booleanFieldCodec.parseForSettle('true')).toEqual({ status: 'valid', value: true });
    expect(booleanFieldCodec.parseForSettle('Ja')).toEqual({ status: 'invalid' });
  });
});
