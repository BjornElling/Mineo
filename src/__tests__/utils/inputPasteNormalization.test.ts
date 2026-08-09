import {
  normalizeAmountPaste,
  normalizeDatePaste,
  normalizeFractionPaste,
  normalizeIntegerPaste,
  normalizePercentPaste,
  normalizeWeekPaste,
  normalizeYearPaste,
} from '../../utils/inputPasteNormalization';

describe('inputPasteNormalization', () => {
  it('normaliserer dato efter cifferlængde og fortsætter gennem ugyldige tegn', () => {
    expect(normalizeDatePaste('adffergregs//sgd1712,56//')).toBe('17-12-56');
    expect(normalizeDatePaste('a1b2c1999')).toBe('1-2-1999');
    expect(normalizeDatePaste('17121956')).toBe('17-12-1956');
    expect(normalizeDatePaste('01012024')).toBe('01-01-2024');
  });

  it('håndhæver kun cifferlængde, springer gentagne separatorer over og fortsætter', () => {
    expect(normalizeDatePaste('32122020')).toBe('32-12-2020');
    expect(normalizeDatePaste('17132020')).toBe('17-13-2020');
    expect(normalizeDatePaste('00122020')).toBe('00-12-2020');
    expect(normalizeDatePaste('3112202')).toBe('31-12-202');
    expect(normalizeDatePaste('12-345-2020')).toBe('12-34-2020');
    expect(normalizeDatePaste('---12--2----------2026')).toBe('12-2-2026');
  });

  it('springer ugyldige heltalstegn over uden at fortolke separatorer', () => {
    expect(normalizeIntegerPaste('adffergregs//sgd1712,56//', { maxDigits: 4 })).toBe('1712');
    expect(normalizeIntegerPaste('12,99')).toBe('1299');
    expect(normalizeIntegerPaste('-12.99', { allowNegative: true })).toBe('-1299');
    expect(normalizeIntegerPaste('ab1712cd', { maxDigits: 3 })).toBe('171');
    expect(normalizeIntegerPaste('12 34')).toBe('1234');
  });

  it('lader talværdi-grænser gå videre til canonical validering', () => {
    expect(normalizeIntegerPaste('9999', { maxValue: 100 })).toBe('9999');
    expect(normalizeIntegerPaste('-9999', { allowNegative: true, minValue: -100 })).toBe('-9999');
  });

  it('bevarer beløbsudtryk, men fortolker aldrig tegn som formattering', () => {
    expect(normalizeAmountPaste('abc12,')).toBe('12,');
    expect(normalizeAmountPaste('foo 100+25')).toBe('100+25');
    expect(normalizeAmountPaste('2X3')).toBe('23');
    expect(normalizeAmountPaste('12,987', { maxDecimalDigits: 2 })).toBe('12,98');
    expect(normalizeAmountPaste('foo - 100,25 bar', { allowNegative: true })).toBe('-100,25');
    expect(normalizeAmountPaste('12.5')).toBe('125');
    expect(normalizeAmountPaste('12 5')).toBe('125');
  });

  it('lader syntaktiske fejl og talværdi-grænser stå til settle', () => {
    expect(normalizeAmountPaste('123,99', { allowDecimals: false })).toBe('12399');
    expect(normalizeAmountPaste('12345,67', { maxIntegerDigits: 3 })).toBe('123,67');
    expect(normalizeAmountPaste('100+25', { maxValue: 100 })).toBe('100+25');
  });

  it('håndhæver beløbets ciffergrænse separat for hvert talled', () => {
    expect(normalizeAmountPaste('99999999+2')).toBe('9999999+2');
    expect(normalizeAmountPaste('1+99999999+3')).toBe('1+9999999+3');
    expect(normalizeAmountPaste('9999999,999+2,999')).toBe('9999999,99+2,99');
  });

  it('filtrerer procent tegn for tegn uden formatteringsfortolkning', () => {
    expect(normalizePercentPaste('abc1007', { maxValue: 100 })).toBe('100');
    expect(normalizePercentPaste('abc999', { maxValue: 8 })).toBe('999');
    expect(normalizePercentPaste('12,987', { allowDecimals: true, maxDecimalDigits: 2 })).toBe('12,98');
    expect(normalizePercentPaste('12,987', { allowDecimals: false })).toBe('129');
    expect(normalizePercentPaste('-999', { allowNegative: true, minValue: -100 })).toBe('-999');
    expect(normalizePercentPaste('12.5', { allowDecimals: true })).toBe('125');
    expect(normalizePercentPaste('12 5', { allowDecimals: true })).toBe('125');
  });

  it('bevarer brøkens formatfejl, når de består af tilladte tegn', () => {
    expect(normalizeFractionPaste('foo12,5/bar8,25baz')).toBe('12,5/8,25');
    expect(normalizeFractionPaste('foo12,5bar')).toBe('12,5');
    expect(normalizeFractionPaste('12345,678/98765,432', { maxDigits: 3 }))
      .toBe('123,678/987,432');
    expect(normalizeFractionPaste('123,9/987,8', { maxDigits: 3, requireIntegerFraction: true }))
      .toBe('123/987');
    expect(normalizeFractionPaste('1,/2')).toBe('1,/2');
    expect(normalizeFractionPaste('1./2')).toBe('1/2');
  });

  it('normaliserer uge med ugegrænse og efterfølgende år', () => {
    expect(normalizeWeekPaste('002025')).toBe('');
    expect(normalizeWeekPaste('adffergregs//sgd1712,56//')).toBe('17/12');
    expect(normalizeWeekPaste('abc539999')).toBe('53/9999');
    expect(normalizeWeekPaste('abc549999')).toBe('5');
    expect(normalizeWeekPaste('abc532035', {
      maxYear: 2030,
      twoDigitYearPolicy: 'infer',
    })).toBe('53/20');
    expect(normalizeWeekPaste('abc532025', { maxDraftLength: 4 })).toBe('53/2');
  });

  it('normaliserer år fra første sammenhængende ciffersekvens', () => {
    expect(normalizeYearPaste('adffergregs//sgd1712,56//')).toBe('1712');
    expect(normalizeYearPaste('abc56def2020')).toBe('56');
    expect(normalizeYearPaste('2035', { maxYear: 2030, twoDigitYearPolicy: 'infer' })).toBe('20');
    expect(normalizeYearPaste('2035', { maxYear: 2030, twoDigitYearPolicy: 'reject' })).toBe('');
  });
});
