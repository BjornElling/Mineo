import { parseOffentligLoenSelection } from '../../../domain/erstatningsopgoerelse/helpers/offentligLoenSelection';

// Delt, ren parsing af offentlig løn-indplacering (U3). Kernen deles nu af beregningsmotoren
// (der mapper reason → throw) og de to inspektions-/visnings-varianter (der returnerer null).
// Testen pinner den feltspecifikke reason-rækkefølge, motorens throw-beskeder afhænger af.
describe('parseOffentligLoenSelection', () => {
  const base = {
    offentligType: 'KL' as const,
    offentligLoenType: 'Månedsløn',
    offentligLoenTrin: 30,
    offentligLoenGruppe: 2,
  };

  it('parser en gyldig indplacering', () => {
    const result = parseOffentligLoenSelection(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selection.overenskomstType).toBe('KL');
      expect(result.selection.loengruppe).toBe(2);
      expect(result.selection.loentrin).toBe(30);
    }
  });

  it('accepterer løntrin 55+', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenTrin: 55 });
    expect(result.ok).toBe(true);
  });

  it('fejler med loentype-mangler når løntype ikke kan opløses', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenType: undefined });
    expect(result).toEqual({ ok: false, reason: 'loentype-mangler' });
  });

  it('fejler med trin-mangler når løntrin ikke er et tal', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenTrin: undefined });
    expect(result).toEqual({ ok: false, reason: 'trin-mangler' });
  });

  it('fejler med trin-ugyldig når løntrin er uden for det gyldige interval', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenTrin: 999 });
    expect(result).toEqual({ ok: false, reason: 'trin-ugyldig' });
  });

  it('fejler med gruppe-mangler når gruppe ikke er et tal', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenGruppe: undefined });
    expect(result).toEqual({ ok: false, reason: 'gruppe-mangler' });
  });

  it('fejler med gruppe-ugyldig når gruppe er uden for [0;4]', () => {
    const result = parseOffentligLoenSelection({ ...base, offentligLoenGruppe: 7 });
    expect(result).toEqual({ ok: false, reason: 'gruppe-ugyldig' });
  });

  it('rapporterer løntrin-fejl før gruppe-fejl (rækkefølge = motorens throw-beskeder)', () => {
    const result = parseOffentligLoenSelection({
      ...base,
      offentligLoenTrin: undefined,
      offentligLoenGruppe: 7,
    });
    expect(result).toEqual({ ok: false, reason: 'trin-mangler' });
  });
});
