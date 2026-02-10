import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { ERSTATNINGSOPGOERELSE_INITIAL_VALUES } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { computeTafBeregningsenhed, TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR, TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/tafBeregningsenhed';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(ERSTATNINGSOPGOERELSE_INITIAL_VALUES);
  return { ...base, ...patch };
};

describe('computeTafBeregningsenhed', () => {
  it('defaults to months', () => {
    const values = makeValues({});
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('returns workdays when "Beregnes ud fra" is "Angivet dagsløn"', () => {
    const values = makeValues({ beregnesUdFra: 'Angivet dagsløn' });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('returns months when "Beregnes ud fra" is "Angivet månedsløn"', () => {
    const values = makeValues({ beregnesUdFra: 'Angivet månedsløn' });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('does not switch to workdays when "Øvrigt fravær uden løn" has a non-zero day count', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: 1,
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('does not switch to workdays when "Øvrigt fravær uden løn" is enabled but day count is 0', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      oevrigtFravaerUdenLoen: 'Ja',
      oevrigeFravaersdage: 0,
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays months for "Angivet månedsløn" even with non-standard holiday pay on employment', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet månedsløn',
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenPaaHelligdage: 'SH-udbetaling',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });

  it('stays workdays for "Angivet dagsløn" even with full-pay vacation settings', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet dagsløn',
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          fuldLoenUnderFerie: 'Ja',
          loenPaaHelligdage: 'Almindelig løn',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('is forced to workdays in "Beregningsperiode" when holiday pay deviates', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenPaaHelligdage: 'SH-udbetaling',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.ARBEJDSDAGE);
  });

  it('stays months in "Beregningsperiode" with standard holiday/vacation settings', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      loenindkomstAnsaettelsesforhold: [
        {
          ...ERSTATNINGSOPGOERELSE_INITIAL_VALUES.loenindkomstAnsaettelsesforhold[0],
          loenPaaHelligdage: 'Almindelig løn',
          fuldLoenUnderFerie: 'Ja',
        },
      ],
    });
    expect(computeTafBeregningsenhed(values)).toBe(TAF_BEREGNES_SOM.MAANEDER);
  });
});

describe('TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR', () => {
  it('is 4.8% of a month per workday', () => {
    expect(TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR).toBe(0.048);
  });
});
