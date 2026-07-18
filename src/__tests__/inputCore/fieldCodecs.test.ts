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

  it('afviser kun format; et velformet år uden for min/max committes canonical (§1.6)', () => {
    const year = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    expect(year.parseForSettle('x')).toMatchObject({ status: 'rejected', reason: 'format' });
    // Out-of-bounds er efter kravændringen 2026-07-18 canonical (bounds-vurderes af en feltvalidator, ikke codecet).
    expect(year.parseForSettle('1990')).toEqual({ status: 'valid', value: 1990 });

    const week = createWeekFieldCodec({
      minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer', maxDraftLength: 8,
    });
    expect(week.parseForSettle('5/2020')).toEqual({ status: 'valid', value: '05/2020' });
    // Årsdelen uden for [minYear, maxYear] er bounds → canonical.
    expect(week.parseForSettle('5/1990')).toEqual({ status: 'valid', value: '05/1990' });
    // Uge-nummeret uden for 1..52/53 er en repræsenterbarhedsgrænse → forbliver format-rejected.
    expect(week.parseForSettle('53/2021')).toMatchObject({ status: 'rejected', reason: 'format' });
  });

  it('bevarer string-backed tomhed; et out-of-bounds år committes canonical som streng (§1.6)', () => {
    const source = createYearFieldCodec({ minYear: 2000, maxYear: 2030, twoDigitYearPolicy: 'infer' });
    const codec = createStringBackedFieldCodec(source);
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(codec.parseForSettle('2020')).toEqual({ status: 'valid', value: '2020' });
    expect(codec.parseForSettle('1990')).toEqual({ status: 'valid', value: '1990' });
    expect(codec.parseForSettle('x')).toMatchObject({ status: 'rejected', reason: 'format' });
  });

  it('canonicaliserer brøker og afviser ugyldig syntaks som format', () => {
    const codec = createFractionFieldCodec({ maxDigits: 10, canonicalizeOnCommit: true });
    expect(codec.parseForSettle('6/4')).toEqual({ status: 'valid', value: '3/2' });
    expect(codec.parseForSettle('1.5/3')).toEqual({ status: 'rejected', reason: 'format' });
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
  });
});
