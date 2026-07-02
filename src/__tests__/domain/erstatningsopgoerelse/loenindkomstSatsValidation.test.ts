import {
  validateFeriePct,
  validateOverenskomstSats,
  validateAllSatserForAnsaettelsesforhold,
} from '../../../domain/erstatningsopgoerelse/validation/loenindkomstSatsValidation';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';
import { TILLAEG_ANGIVES_SOM } from '../../../types/loen';

// Isolations-tests for det rene sats-valideringslag (uden React-render) — jf. arkitektur-kandidat A1.

describe('validateFeriePct', () => {
  it('kræver udfyldelse når værdi mangler og feriePct er påkrævet', () => {
    expect(validateFeriePct('Nej', undefined, true)).toBe('Feriegodtgørelse/-tillæg skal udfyldes');
  });

  it('giver ingen fejl når værdi mangler og feriePct ikke er påkrævet', () => {
    expect(validateFeriePct('Nej', undefined, false)).toBeUndefined();
  });

  it('giver ingen fejl ved 12 % eller derover', () => {
    expect(validateFeriePct('Nej', 12, true)).toBeUndefined();
    expect(validateFeriePct('Ja', 12.5, false)).toBeUndefined();
  });

  it('vejleder mod 12,5 %/15 % når værdi er under 12 % og der ikke er fuld løn under ferie', () => {
    expect(validateFeriePct('Nej', 10, false)).toBe(
      'Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge'
    );
  });

  it('forklarer feriegodtgørelses-beregning når der er fuld løn under ferie og værdi er under 12 %', () => {
    expect(validateFeriePct('Ja', 10, false)).toBe(
      'Løn under ferie beregnes som feriegodtgørelse (12,5 % eller 15 % ved ret til 6. ferieuge)'
    );
  });
});

describe('validateOverenskomstSats', () => {
  const lockedAf = () => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
    loenPaaHelligdage: 'Almindelig løn' as const,
  });

  it('returnerer undefined når der ikke er valgt overenskomst', () => {
    const af = { ...createDefaultLoenindkomstAnsaettelsesforhold(), overenskomstId: undefined };
    expect(validateOverenskomstSats(af, 'fritvalgPct', 3, toISODateString('2024-01-01'))).toBeUndefined();
  });

  it('returnerer undefined når der ikke er nogen anvendt reguleringsdato', () => {
    expect(validateOverenskomstSats(lockedAf(), 'fritvalgPct', 3, undefined)).toBeUndefined();
  });

  it('giver fejl med den låste sats når input afviger fra overenskomstens låste fritvalg (0 %)', () => {
    // bygge-anlaeg låser fritvalgPct til 0 % per 2024-01-01.
    const msg = validateOverenskomstSats(lockedAf(), 'fritvalgPct', 3, toISODateString('2024-01-01'));
    expect(msg).toBeDefined();
    expect(msg).toContain('0,00 %');
  });

  it('giver ingen fejl når input matcher den låste sats', () => {
    expect(validateOverenskomstSats(lockedAf(), 'fritvalgPct', 0, toISODateString('2024-01-01'))).toBeUndefined();
  });

  it('giver ingen fejl for ulåst felt (KL-overenskomst låser ikke satser)', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };
    expect(validateOverenskomstSats(af, 'fritvalgPct', 3.5, toISODateString('2024-01-01'))).toBeUndefined();
  });
});

describe('validateAllSatserForAnsaettelsesforhold', () => {
  const ctx = (anvendtReguleringsdato?: string) => ({
    anvendtReguleringsdato: anvendtReguleringsdato ? toISODateString(anvendtReguleringsdato) : undefined,
    beregnesUdFra: 'Beregningsperiode' as const,
  });

  it('validerer ikke de skjulte satsfelter i Beløb-tilstand', () => {
    // Beløb-tilstand bruger løntabellens beløb og den manuelle lønudviklingstabel som kilde;
    // de skjulte top-satsfelter må derfor ikke give blokeringer.
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.BELOEB,
      fuldLoenUnderFerie: 'Nej' as const,
      feriePct: 5,
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3,
    };
    const errors = validateAllSatserForAnsaettelsesforhold(af, ctx());
    expect(errors).toEqual({});
  });

  it('udløser ferie-fejl i procent-tilstand når feriePct er under 12 %', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
      fuldLoenUnderFerie: 'Nej' as const,
      feriePct: 10,
    };
    const errors = validateAllSatserForAnsaettelsesforhold(af, ctx());
    expect(errors.feriePct).toBe('Feriegodtgørelse udgør typisk 12,5 %, men 15 % ved ret til 6. ferieuge');
  });

  it('samler både ferie-fejl og overenskomst-sats-fejl', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fuldLoenUnderFerie: 'Nej' as const,
      feriePct: 10,
      fritvalgPct: 3, // afviger fra låst 0 %
    };
    const errors = validateAllSatserForAnsaettelsesforhold(af, ctx('2024-01-01'));
    expect(errors.feriePct).toBeDefined();
    expect(errors.fritvalgPct).toBeDefined();
  });

  it('giver ingen fejl når alle satser er korrekte', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      tillaegAngivesSom: TILLAEG_ANGIVES_SOM.PROCENT,
      fuldLoenUnderFerie: 'Nej' as const,
      feriePct: 12.5,
      overenskomstId: undefined,
    };
    expect(validateAllSatserForAnsaettelsesforhold(af, ctx())).toEqual({});
  });
});
