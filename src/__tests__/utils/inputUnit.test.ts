import {
  INPUT_UNIT_SUFFIX,
  appendInputUnitSuffix,
  withInputUnitPlaceholderSuffix,
} from '../../utils/inputUnit';

describe('inputUnit', () => {
  describe('INPUT_UNIT_SUFFIX', () => {
    it('definerer enhederne med ledende mellemrum', () => {
      expect(INPUT_UNIT_SUFFIX.currency).toBe(' kr.');
      expect(INPUT_UNIT_SUFFIX.percent).toBe(' %');
    });
  });

  describe('appendInputUnitSuffix', () => {
    it('tilføjer enheden til en ikke-tom visning', () => {
      expect(appendInputUnitSuffix('12.500', INPUT_UNIT_SUFFIX.currency)).toBe('12.500 kr.');
      expect(appendInputUnitSuffix('12,5', INPUT_UNIT_SUFFIX.percent)).toBe('12,5 %');
    });

    it('lader en tom streng være tom (placeholder skal kunne vise sig)', () => {
      expect(appendInputUnitSuffix('', INPUT_UNIT_SUFFIX.currency)).toBe('');
    });

    it('er idempotent — en streng der allerede ender på enheden røres ikke', () => {
      expect(appendInputUnitSuffix('12.500 kr.', INPUT_UNIT_SUFFIX.currency)).toBe('12.500 kr.');
      expect(appendInputUnitSuffix('12,5 %', INPUT_UNIT_SUFFIX.percent)).toBe('12,5 %');
    });
  });

  describe('withInputUnitPlaceholderSuffix', () => {
    it('tilføjer enheden til en ikke-tom placeholder', () => {
      expect(withInputUnitPlaceholderSuffix('0,00', INPUT_UNIT_SUFFIX.currency)).toBe('0,00 kr.');
      expect(withInputUnitPlaceholderSuffix('0', INPUT_UNIT_SUFFIX.percent)).toBe('0 %');
    });

    it('lader en tom placeholder være urørt', () => {
      expect(withInputUnitPlaceholderSuffix('', INPUT_UNIT_SUFFIX.currency)).toBe('');
    });

    it('er idempotent', () => {
      expect(withInputUnitPlaceholderSuffix('0 %', INPUT_UNIT_SUFFIX.percent)).toBe('0 %');
    });
  });
});
