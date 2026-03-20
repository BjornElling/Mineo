import { isLoenperiodeValue, isLoenPaaHelligdageValue } from '../../utils/zodTypeGuards';

describe('isLoenperiodeValue', () => {
  it('gyldige lønperioder → true', () => {
    expect(isLoenperiodeValue('maaned')).toBe(true);
    expect(isLoenperiodeValue('uge')).toBe(true);
    expect(isLoenperiodeValue('dag')).toBe(true);
  });

  it('ugyldige strenge → false', () => {
    expect(isLoenperiodeValue('månedlig')).toBe(false);
    expect(isLoenperiodeValue('time')).toBe(false);
    expect(isLoenperiodeValue('')).toBe(false);
    expect(isLoenperiodeValue('Maaned')).toBe(false); // case-sensitiv
  });

  it('ikke-string typer → false', () => {
    expect(isLoenperiodeValue(null)).toBe(false);
    expect(isLoenperiodeValue(undefined)).toBe(false);
    expect(isLoenperiodeValue(42)).toBe(false);
    expect(isLoenperiodeValue({})).toBe(false);
    expect(isLoenperiodeValue([])).toBe(false);
  });
});

describe('isLoenPaaHelligdageValue', () => {
  it('gyldige LoenPaaHelligdage-værdier → true', () => {
    expect(isLoenPaaHelligdageValue('Almindelig løn')).toBe(true);
    expect(isLoenPaaHelligdageValue('SH-udbetaling')).toBe(true);
    expect(isLoenPaaHelligdageValue('Ingen')).toBe(true);
  });

  it('ugyldige strenge → false', () => {
    expect(isLoenPaaHelligdageValue('almindelig løn')).toBe(false); // case-sensitiv
    expect(isLoenPaaHelligdageValue('sh-udbetaling')).toBe(false);
    expect(isLoenPaaHelligdageValue('ingen')).toBe(false);
    expect(isLoenPaaHelligdageValue('')).toBe(false);
    expect(isLoenPaaHelligdageValue('Løn')).toBe(false);
  });

  it('ikke-string typer → false', () => {
    expect(isLoenPaaHelligdageValue(null)).toBe(false);
    expect(isLoenPaaHelligdageValue(undefined)).toBe(false);
    expect(isLoenPaaHelligdageValue(0)).toBe(false);
    expect(isLoenPaaHelligdageValue(true)).toBe(false);
  });
});
