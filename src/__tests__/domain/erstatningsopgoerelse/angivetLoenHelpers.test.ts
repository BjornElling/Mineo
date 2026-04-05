import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import {
  EO_ANGIVET_LOEN_ID,
  LoenudviklingKildeError,
  getAngivetLoenBaseretPaa,
  getAngivetLoenOpreguleresFraDato,
  resolveLoenudviklingKilde,
} from '../../../domain/erstatningsopgoerelse/helpers/angivetLoenHelpers';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { toISODateString } from '../../../types/branded';

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
    values.eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen = true;
    values.eoAngivetLoenLoenudvikling.anciennitetstillaegDato = toISODateString('2024-01-15');

    const result = resolveLoenudviklingKilde(values);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(EO_ANGIVET_LOEN_ID);
    expect(result[0].loenPaaHelligdage).toBe(LOEN_PAA_HELLIGDAGE.ALMINDELIG);
    expect(result[0].harAnciennitetstillaegEfterSkadedatoen).toBe(true);
    expect(result[0].anciennitetstillaegDato).toBe(toISODateString('2024-01-15'));
    expect(result[0].anciennitetstillaegSatsAngivesPer).toBe('Måned');
  });

  it('returnerer EO-kilde for angivet dagsløn med gyldig loenPaaHelligdage', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    values.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.SH_UDBETALING;
    values.eoAngivetLoenLoenudvikling.anciennitetstillaegSatsAngivesPer = 'Måned';

    const result = resolveLoenudviklingKilde(values);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(EO_ANGIVET_LOEN_ID);
    expect(result[0].loenPaaHelligdage).toBe(LOEN_PAA_HELLIGDAGE.SH_UDBETALING);
    expect(result[0].anciennitetstillaegSatsAngivesPer).toBe('Time');
  });

  it('EO-kilde har navnPaaArbejdssted = "EO-oplysninger" og loenperiode = maaned', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    values.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.INGEN;

    const result = resolveLoenudviklingKilde(values);
    expect(result[0].navnPaaArbejdssted).toBe('EO-oplysninger');
    expect(result[0].fuldLoenUnderFerie).toBe('Ja');
    expect(result[0].loenPaaHelligdage).toBe(LOEN_PAA_HELLIGDAGE.INGEN);
  });

  it('kaster LoenudviklingKildeError med korrekt code ved ugyldig loenPaaHelligdage', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    (values.eoAngivetLoenLoenudvikling as any).loenPaaHelligdage = undefined;

    expect(() => resolveLoenudviklingKilde(values)).toThrow(LoenudviklingKildeError);
    try {
      resolveLoenudviklingKilde(values);
    } catch (err) {
      expect(err).toBeInstanceOf(LoenudviklingKildeError);
      expect((err as LoenudviklingKildeError).code).toBe('invalid_loen_paa_helligdage');
      expect((err as LoenudviklingKildeError).name).toBe('LoenudviklingKildeError');
    }
  });

  it('kaster LoenudviklingKildeError med korrekt code ved ukendt beregnesUdFra', () => {
    const values = createErstatningsopgoerelseInitialValues();
    (values as any).beregnesUdFra = 'Ukendt';

    expect(() => resolveLoenudviklingKilde(values)).toThrow(LoenudviklingKildeError);
    try {
      resolveLoenudviklingKilde(values);
    } catch (err) {
      expect((err as LoenudviklingKildeError).code).toBe('invalid_beregnes_udfra');
    }
  });

  it('bevarer anciennitet-felter konsistent mellem Beregningsperiode-kilde og EO-kilde (angivet månedsløn)', () => {
    const anciennitetDato = toISODateString('2024-04-01');
    const anciennitetSats = { kind: 'number', value: 750 } as const;

    const beregningsperiodeValues = createErstatningsopgoerelseInitialValues();
    beregningsperiodeValues.beregnesUdFra = 'Beregningsperiode';
    beregningsperiodeValues.loenindkomstAnsaettelsesforhold = [createDefaultLoenindkomstAnsaettelsesforhold()];
    beregningsperiodeValues.loenindkomstAnsaettelsesforhold[0].harAnciennitetstillaegEfterSkadedatoen = true;
    beregningsperiodeValues.loenindkomstAnsaettelsesforhold[0].anciennitetstillaegDato = anciennitetDato;
    beregningsperiodeValues.loenindkomstAnsaettelsesforhold[0].anciennitetstillaegSatsAngivesPer = 'Måned';
    beregningsperiodeValues.loenindkomstAnsaettelsesforhold[0].anciennitetstillaegSats = anciennitetSats;

    const angivetValues = createErstatningsopgoerelseInitialValues();
    angivetValues.beregnesUdFra = 'Angivet månedsløn';
    angivetValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    angivetValues.eoAngivetLoenLoenudvikling.harAnciennitetstillaegEfterSkadedatoen = true;
    angivetValues.eoAngivetLoenLoenudvikling.anciennitetstillaegDato = anciennitetDato;
    angivetValues.eoAngivetLoenLoenudvikling.anciennitetstillaegSats = anciennitetSats;

    const beregningsperiodeSource = resolveLoenudviklingKilde(beregningsperiodeValues)[0];
    const angivetSource = resolveLoenudviklingKilde(angivetValues)[0];

    expect(angivetSource.harAnciennitetstillaegEfterSkadedatoen)
      .toBe(beregningsperiodeSource.harAnciennitetstillaegEfterSkadedatoen);
    expect(angivetSource.anciennitetstillaegDato).toBe(beregningsperiodeSource.anciennitetstillaegDato);
    expect(angivetSource.anciennitetstillaegSats).toEqual(beregningsperiodeSource.anciennitetstillaegSats);
    expect(angivetSource.anciennitetstillaegSatsAngivesPer).toBe('Måned');
  });
});

describe('getAngivetLoenBaseretPaa', () => {
  it('returnerer angivetMaanedsloenBaseretPaa for Angivet månedsløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    (values as any).angivetMaanedsloenBaseretPaa = 'Timeløn';

    expect(getAngivetLoenBaseretPaa(values)).toBe('Timeløn');
  });

  it('returnerer angivetDagsloenBaseretPaa for Angivet dagsløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    (values as any).angivetDagsloenBaseretPaa = 'Grundløn';

    expect(getAngivetLoenBaseretPaa(values)).toBe('Grundløn');
  });

  it('returnerer undefined for Beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';

    expect(getAngivetLoenBaseretPaa(values)).toBeUndefined();
  });
});

describe('getAngivetLoenOpreguleresFraDato', () => {
  it('returnerer angivetMaanedsloenOpreguleresFraDato for Angivet månedsløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet månedsløn';
    const dato = toISODateString('2024-01-01');
    (values as any).angivetMaanedsloenOpreguleresFraDato = dato;

    expect(getAngivetLoenOpreguleresFraDato(values)).toBe(dato);
  });

  it('returnerer angivetDagsloenOpreguleresFraDato for Angivet dagsløn', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Angivet dagsløn';
    const dato = toISODateString('2023-06-15');
    (values as any).angivetDagsloenOpreguleresFraDato = dato;

    expect(getAngivetLoenOpreguleresFraDato(values)).toBe(dato);
  });

  it('returnerer undefined for Beregningsperiode', () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.beregnesUdFra = 'Beregningsperiode';

    expect(getAngivetLoenOpreguleresFraDato(values)).toBeUndefined();
  });
});
