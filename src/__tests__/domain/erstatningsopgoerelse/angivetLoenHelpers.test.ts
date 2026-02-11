import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { EO_ANGIVET_LOEN_ID, resolveLoenudviklingKilde } from '../../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/common';

describe('resolveLoenudviklingKilde', () => {
  it('returnerer ansættelsesforhold for Beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';

    const result = resolveLoenudviklingKilde(values);
    expect(result).toEqual(values.loenindkomstAnsaettelsesforhold ?? []);
  });

  it('returnerer EO-kilde for angivet månedsløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;

    const result = resolveLoenudviklingKilde(values);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(EO_ANGIVET_LOEN_ID);
    expect(result[0].loenPaaHelligdage).toBe(LOEN_PAA_HELLIGDAGE.ALMINDELIG);
  });

  it('kaster fejl ved ugyldig loenPaaHelligdage', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    (values.eoAngivetLoenLoenudvikling as any).loenPaaHelligdage = undefined;

    expect(() => resolveLoenudviklingKilde(values)).toThrow();
  });

  it('kaster fejl ved ukendt beregnesUdFra', () => {
    const values = createErstatningsopgoerelseInitialValues();
    (values as any).beregnesUdFra = 'Ukendt';

    expect(() => resolveLoenudviklingKilde(values)).toThrow();
  });
});
