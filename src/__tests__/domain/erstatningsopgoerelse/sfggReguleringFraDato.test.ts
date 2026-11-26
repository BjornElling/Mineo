import { resolveSfggReguleringFraDato } from '../../../domain/erstatningsopgoerelse/engines/sfggSegmentering';
import { toISODateString } from '../../../types/branded';

const iso = toISODateString;

// Bilagets «reguleret … fra …» og beregningens referencedato læses fra samme regel.
describe('resolveSfggReguleringFraDato', () => {
  it('regulerer fra reguleringsdatoen, når en manuel form har en ældre referenceperiode', () => {
    expect(resolveSfggReguleringFraDato({ manuelBasisDato: iso('2023-02-28') }, iso('2022-02-27')))
      .toEqual({ dato: iso('2023-02-28'), fraReguleringsdato: true });
  });

  it('regulerer fra referenceperiodens slutdato uden manuel basisdato eller ved en senere referenceperiode', () => {
    expect(resolveSfggReguleringFraDato({}, iso('2022-02-27')))
      .toEqual({ dato: iso('2022-02-27'), fraReguleringsdato: false });
    expect(resolveSfggReguleringFraDato({ manuelBasisDato: iso('2023-02-28') }, iso('2023-03-31')))
      .toEqual({ dato: iso('2023-03-31'), fraReguleringsdato: false });
  });
});
