import {
  createAmountFieldCodec,
  createChoiceFieldCodec,
  createSelectionFieldCodec,
  booleanFieldCodec,
  createDateFieldCodec,
  createFractionFieldCodec,
  createIntegerFieldCodec,
  createRequiredChoiceFieldCodec,
  createStringBackedFieldCodec,
  createPercentFieldCodec,
  createTextFieldCodec,
  textFieldCodec,
  createWeekFieldCodec,
  createYearFieldCodec,
} from '../../input/fieldCodecs';
import { toISODateString } from '../../types/branded';
import { DEFAULT_FRACTION_MAX_DIGITS } from '../../utils/fraction';

describe('fieldCodecs', () => {
  it('afviser tom tekst for påkrævede valg', () => {
    const codec = createRequiredChoiceFieldCodec(['Ja', 'Nej'] as const);

    expect(codec.parseForSettle('Ja')).toEqual({ status: 'valid', value: 'Ja' });
    expect(codec.parseForSettle('')).toEqual({ status: 'invalid' });
    expect(codec.parseForSettle('Måske')).toEqual({ status: 'invalid' });
  });

  it('genbruger talcodecets semantik uden at ændre canonical strengrepræsentation', () => {
    const codec = createStringBackedFieldCodec(createIntegerFieldCodec({
      allowNegative: false,
      maxDigits: 2,
      minValue: 1,
      maxValue: 12,
    }));

    expect(codec.parseForSettle(' 07 ')).toEqual({ status: 'valid', value: '7' });
    expect(codec.parseForSettle('')).toEqual({ status: 'valid', value: '' });
    expect(codec.parseForSettle(' (07) ')).toEqual({ status: 'valid', value: '7' });
    expect(codec.parseForSettle('x')).toEqual({ status: 'invalid' });
    expect(codec.format('legacy-værdi')).toBe('legacy-værdi');
    expect(codec.formatForEdit('07')).toBe('07');
    expect(codec.acceptsInitialKey('7')).toBe(true);
    expect(codec.acceptsInitialKey('-')).toBe(false);
    expect(codec.normalizePaste?.('12,9')).toBe('12');
  });

  it('deler canonical parsing og formatering for de numeriske inputfamilier', () => {
    const amount = createAmountFieldCodec({
      allowNegative: false,
      allowDecimals: true,
    });
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
    expect(createAmountFieldCodec({ allowNegative: false, allowDecimals: false }).parseForSettle('1,25'))
      .toEqual({ status: 'invalid' });
    expect(amount.format({ kind: 'number', value: 1250.5 })).toBe('1.250,50');
    expect(percent.format(12.5)).toBe('12,50');
    expect(integer.format(42)).toBe('42');
  });

  it('behandler kun reelt tom dato- og beløbstekst som canonical tomhed', () => {
    const date = createDateFieldCodec({ twoDigitYearPolicy: 'assume20xx' });
    const amount = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });

    expect(date.parseForSettle('   ')).toEqual({ status: 'valid', value: undefined });
    expect(date.parseForSettle('0')).toEqual({ status: 'invalid' });
    expect(date.parseForSettle('-')).toEqual({ status: 'invalid' });
    expect(amount.parseForSettle('   ')).toEqual({ status: 'valid', value: undefined });
    expect(amount.parseForSettle('-')).toEqual({ status: 'invalid' });
    expect(amount.parseForSettle('()')).toEqual({ status: 'invalid' });
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
    expect(date.format(toISODateString('2024-02-01'))).toBe('01-02-2024');
    expect(year.format(2024)).toBe('2024');
    expect(week.format('03/2024')).toBe('03/2024');
    expect(fraction.format('1/2')).toBe('1/2');
  });

  it('afviser parsebare værdier uden for codecets aktive commit-interval', () => {
    const amount = createAmountFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      maxValue: 100,
    });
    const percent = createPercentFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      minValue: 0,
      maxValue: 100,
    });
    const integer = createIntegerFieldCodec({ allowNegative: false, minValue: 1, maxValue: 12 });
    const year = createYearFieldCodec({ twoDigitYearPolicy: 'reject', minYear: 2000, maxYear: 2100 });
    const week = createWeekFieldCodec({
      twoDigitYearPolicy: 'reject', minYear: 2000, maxYear: 2100, maxDraftLength: 8,
    });

    expect(amount.parseForSettle('150')).toEqual({ status: 'invalid' });
    expect(percent.parseForSettle('150')).toEqual({ status: 'invalid' });
    expect(integer.parseForSettle('13')).toEqual({ status: 'invalid' });
    expect(year.parseForSettle('1999')).toEqual({ status: 'invalid' });
    expect(week.parseForSettle('52/1999')).toEqual({ status: 'invalid' });
    expect(week.parseForSettle('53/2023')).toEqual({ status: 'invalid' });
  });

  it('bruger samme canonical trimning for alle tekstfelter', () => {
    expect(createTextFieldCodec()).toBe(textFieldCodec);
    expect(createTextFieldCodec().parseForSettle('  Mineo  ')).toEqual({ status: 'valid', value: 'Mineo' });
    expect(createTextFieldCodec().formatForEdit('  Mineo  ')).toBe('  Mineo  ');
  });

  it('afskærer brøk-kanttegn som StyledFractionField-controllen (trimToAlphanumericEdges)', () => {
    const fraction = createFractionFieldCodec({
      maxDigits: DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative: false,
      allowZeroNumerator: false,
      canonicalizeOnCommit: false,
      requireIntegerFraction: false,
    });

    // Ikke-alfanumeriske kanttegn (parenteser/mellemrum) afskæres før parse — samme
    // normalisering controllen bruger via `normalizeDraftOnCommit`, så katalog og UI giver
    // identisk canonical resultat.
    expect(fraction.parseForSettle('  1/3  ')).toEqual({ status: 'valid', value: '1/3' });
    expect(fraction.parseForSettle('(1/3)')).toEqual({ status: 'valid', value: '1/3' });
    // Kun kanttegn, ingen cifre → canonical tomhed (undefined), ikke rejected.
    expect(fraction.parseForSettle('   ')).toEqual({ status: 'valid', value: undefined });
    expect(fraction.parseForSettle('()')).toEqual({ status: 'valid', value: undefined });
    // Et førende minus er et kanttegn og afskæres FØR parse — præcis som controllen gør: "-1/3"
    // bliver "1/3" og accepteres, selv med allowNegative=false. (Minus midt i draften ville nå parseren.)
    expect(fraction.parseForSettle('-1/3')).toEqual({ status: 'valid', value: '1/3' });
  });

  it('bevarer beløbsudtrykket som edit-tekst uden at ændre den lukkede visning', () => {
    const amount = createAmountFieldCodec({ allowNegative: true, allowDecimals: true });
    const expression = { kind: 'expression' as const, expression: '1000+0,5', value: 1000.5 };

    expect(amount.format(expression)).toBe('1.000,50');
    expect(amount.formatForEdit(expression)).toBe('1000+0,5');
    expect(amount.parseForSettle(amount.formatForEdit(expression))).toEqual({
      status: 'valid',
      value: expression,
    });
  });

  it('accepterer kun et controls udtrykkeligt registrerede valg', () => {
    const choice = createChoiceFieldCodec(['Ja', 'Nej'] as const);

    expect(choice.parseForSettle('Ja')).toEqual({ status: 'valid', value: 'Ja' });
    expect(choice.parseForSettle('')).toEqual({ status: 'valid', value: undefined });
    expect(choice.parseForSettle('Måske')).toEqual({ status: 'invalid' });
    expect(choice.format('Nej')).toBe('Nej');
    expect(() => createChoiceFieldCodec([])).toThrow('ChoiceFieldCodec: valgmængden skal være ikke-tom og uden dubletter');
  });

  it('afviser selection-visningstekster som ikke kan roundtrippe entydigt', () => {
    expect(() => createSelectionFieldCodec({
      values: ['Ja'] as const,
      formatOption: () => '',
    })).toThrow('SelectionFieldCodec: visningstekster skal være ikke-tomme og uden ydre mellemrum');
    expect(() => createSelectionFieldCodec({
      values: ['Ja'] as const,
      formatOption: () => ' Ja',
    })).toThrow('SelectionFieldCodec: visningstekster skal være ikke-tomme og uden ydre mellemrum');
    expect(() => createSelectionFieldCodec({
      values: [1, 2] as const,
      formatOption: () => 'Samme',
    })).toThrow('SelectionFieldCodec: valgmængden skal være ikke-tom og have entydige visningstekster');

    const selection = createSelectionFieldCodec({
      values: [1, 2] as const,
      formatOption: (value) => `Valg ${value}`,
    });
    expect(selection.parseForSettle(selection.format(2))).toEqual({ status: 'valid', value: 2 });
  });

  it('bevarer typen for dropdown-tal og toggles', () => {
    const selection = createSelectionFieldCodec({ values: [12, 24] as const });

    expect(selection.parseForSettle('24')).toEqual({ status: 'valid', value: 24 });
    expect(booleanFieldCodec.parseForSettle('true')).toEqual({ status: 'valid', value: true });
    expect(booleanFieldCodec.parseForSettle('Ja')).toEqual({ status: 'invalid' });
    expect(booleanFieldCodec.format(false)).toBe('false');
  });

  it('afviser numeriske dropdown-valg som ikke kan repræsenteres sikkert', () => {
    const error = 'SelectionFieldCodec: numeriske valg skal være endelige og sikkert repræsenterbare';

    expect(() => createSelectionFieldCodec({ values: [Number.NaN] })).toThrow(error);
    expect(() => createSelectionFieldCodec({ values: [Number.POSITIVE_INFINITY] })).toThrow(error);
    expect(() => createSelectionFieldCodec({ values: [Number.MAX_SAFE_INTEGER + 1] })).toThrow(error);
    expect(() => createSelectionFieldCodec({ values: [0.5, Number.MAX_SAFE_INTEGER] })).not.toThrow();
  });

  it('håndhæver første-tast-regler og eksisterende paste-normalisering gennem codecet', () => {
    const date = createDateFieldCodec({ twoDigitYearPolicy: 'assume20xx' });
    const amount = createAmountFieldCodec({ allowNegative: false, allowDecimals: true, maxValue: 100 });
    const percent = createPercentFieldCodec({ allowNegative: true, allowDecimals: true, maxValue: 100 });
    const integer = createIntegerFieldCodec({ allowNegative: false, maxDigits: 4, maxValue: 100 });
    const year = createYearFieldCodec({
      twoDigitYearPolicy: 'infer',
      minYear: 2000,
      maxYear: 2030,
    });
    const week = createWeekFieldCodec({
      twoDigitYearPolicy: 'infer',
      minYear: 2000,
      maxYear: 2030,
      maxDraftLength: 7,
    });
    const fraction = createFractionFieldCodec({ maxDigits: 3, requireIntegerFraction: true });

    expect(date.acceptsInitialKey('1')).toBe(true);
    expect(date.acceptsInitialKey('-')).toBe(false);
    expect(amount.acceptsInitialKey('-')).toBe(false);
    expect(amount.acceptsInitialKey('(')).toBe(true);
    expect(percent.acceptsInitialKey('-')).toBe(true);
    expect(percent.acceptsInitialKey('.')).toBe(false);
    expect(date.normalizePaste?.('Dato: 1/2/2024')).toBe('1-2-2024');
    expect(date.normalizePaste?.('32122024')).toBe('3');
    expect(date.normalizePaste?.('3112202')).toBe('31-12-20');
    expect(amount.normalizePaste?.('1.250,50 kr.')).toBe('12');
    expect(amount.normalizePaste?.('2X3')).toBe('2x3');
    expect(percent.normalizePaste?.('1712,56 %')).toBe('17');
    expect(integer.normalizePaste?.('1712,56')).toBe('17');
    expect(year.normalizePaste?.('2035')).toBe('20');
    expect(week.normalizePaste?.('532035')).toBe('53/20');
    expect(fraction.normalizePaste?.('12345,6/98765,4')).toBe('123/987');
  });

  it('bruger samme statiske commit-interval ved paste og settle', () => {
    const amount = createAmountFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      maxValue: 100,
    });
    const integer = createIntegerFieldCodec({ allowNegative: false, maxValue: 100 });
    const year = createYearFieldCodec({ twoDigitYearPolicy: 'infer', maxYear: 2030 });

    expect(amount.normalizePaste?.('1250,50')).toBe('12');
    expect(amount.parseForSettle('1250,50')).toEqual({ status: 'invalid' });
    expect(integer.normalizePaste?.('1712')).toBe('17');
    expect(integer.parseForSettle('1712')).toEqual({ status: 'invalid' });
    expect(year.normalizePaste?.('2035')).toBe('20');
    expect(year.parseForSettle('2035')).toEqual({ status: 'invalid' });
  });

  it('afviser ugyldig codec-konfiguration ved konstruktion', () => {
    expect(() => createIntegerFieldCodec({ allowNegative: false, maxDigits: 0 }))
      .toThrow('IntegerFieldCodec: maxDigits skal være et positivt heltal');
    expect(() => createWeekFieldCodec({ twoDigitYearPolicy: 'reject', maxDraftLength: 0 }))
      .toThrow('WeekFieldCodec: maxDraftLength skal være et positivt heltal');
    expect(() => createFractionFieldCodec({ maxDigits: Number.NaN }))
      .toThrow('FractionFieldCodec: maxDigits skal være et positivt heltal');
    expect(() => createAmountFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      minValue: 10,
      maxValue: 9,
    })).toThrow('AmountFieldCodec: Ugyldig konfiguration: minValue er større end maxValue');
    expect(() => createPercentFieldCodec({
      allowNegative: false,
      allowDecimals: true,
      minValue: Number.NaN,
    })).toThrow('PercentFieldCodec: Ugyldig konfiguration: minValue skal være et tal');
    expect(() => createIntegerFieldCodec({
      allowNegative: false,
      minValue: 0.5,
    })).toThrow('IntegerFieldCodec: minValue kan ikke repræsenteres canonical');
    expect(() => createYearFieldCodec({
      twoDigitYearPolicy: 'infer',
      minYear: 2030,
      maxYear: 2020,
    })).toThrow('YearFieldCodec: Ugyldig konfiguration: minValue er større end maxValue');
  });
});
