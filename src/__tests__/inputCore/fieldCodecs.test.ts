import {
  booleanFieldCodec,
  createChoiceFieldCodec,
  createFractionFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
  optionalTextFieldCodec,
  textFieldCodec,
} from '../../inputCore';

describe('greenfield fieldCodecs', () => {
  it('canonicaliserer tomhed efter codecets værditype', () => {
    expect(textFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: '' });
    expect(optionalTextFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: undefined });
    expect(booleanFieldCodec.parseForSettle('  ')).toEqual({ status: 'valid', value: false });
    expect(createChoiceFieldCodec(['a', 'b']).parseForSettle('  ')).toEqual({ status: 'valid', value: undefined });
    expect(createRequiredChoiceFieldCodec(['a', 'b'], 'a').parseForSettle('  '))
      .toEqual({ status: 'valid', value: 'a' });
  });

  it('adskiller format og range for år og uge', () => {
    const year = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    expect(year.parseForSettle('x')).toMatchObject({ status: 'rejected', reason: 'format' });
    expect(year.parseForSettle('1990')).toMatchObject({
      status: 'rejected', reason: 'range', detail: { minValue: 2000, maxValue: 2030 },
    });

    const week = createWeekFieldCodec({
      minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer', maxDraftLength: 8,
    });
    expect(week.parseForSettle('5/2020')).toEqual({ status: 'valid', value: '05/2020' });
    expect(week.parseForSettle('53/2021')).toMatchObject({ status: 'rejected', reason: 'range' });
  });

  it('bevarer string-backed tomhed og videresender afvisningsårsagen', () => {
    const source = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    const codec = createStringBackedFieldCodec(source);
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(codec.parseForSettle('2020')).toEqual({ status: 'valid', value: '2020' });
    expect(codec.parseForSettle('1990')).toMatchObject({ status: 'rejected', reason: 'range' });
  });

  it('canonicaliserer brøker og afviser ugyldig syntaks som format', () => {
    const codec = createFractionFieldCodec({ maxDigits: 10, canonicalizeOnCommit: true });
    expect(codec.parseForSettle('6/4')).toEqual({ status: 'valid', value: '3/2' });
    expect(codec.parseForSettle('1.5/3')).toEqual({ status: 'rejected', reason: 'format' });
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
  });
});
