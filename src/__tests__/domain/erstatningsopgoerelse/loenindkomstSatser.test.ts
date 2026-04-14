import {
  applyAutoSatsFields,
  buildLoenindkomstRateSegments,
  isOverenskomstSatsFieldLocked,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('loenindkomstSatser', () => {
  it('fastsætter overenskomststyrede satser ud fra anvendtReguleringsdato', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
    };

    const result = applyAutoSatsFields(ansaettelsesforhold, '2024-01-01');

    expect(result.fritvalgPct).toBe(0);
    expect(result.shSoPct).toBeCloseTo(7, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
  });

  it('opdaterer Store Bededagstillæg når løn på helligdage ændres', () => {
    const base = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    const withAlmindeligLoen = applyAutoSatsFields(base, '2024-01-01');
    const withShUdbetaling = applyAutoSatsFields({
      ...withAlmindeligLoen,
      loenPaaHelligdage: 'SH-udbetaling' as const,
    }, '2024-01-01');

    expect(withAlmindeligLoen.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(withShUdbetaling.storeBededagPct).toBe(0);
  });

  it('opdaterer Store Bededagstillæg når reguleringsdato flyttes over 01-01-2024-grænsen', () => {
    const base = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    const beforeThreshold = applyAutoSatsFields(base, '2023-12-31');
    const afterThreshold = applyAutoSatsFields(base, '2024-01-01');

    expect(beforeThreshold.storeBededagPct).toBe(0);
    expect(afterThreshold.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('falder tilbage til skadedato for Store Bededagstillæg når ingen særlig dato er udfyldt', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    }, '2024-02-01');

    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('fastsætter overenskomststyrede satser når alle overenskomstsfelter er tomme', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
    }, '2024-01-01');

    expect(result.fritvalgPct).toBe(0);
    expect(result.shSoPct).toBeCloseTo(7, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
  });

  it('bevarer de sidst fastsatte satser når overenskomst fravælges igen', () => {
    const autoSynced = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    }, '2024-01-01');

    const result = applyAutoSatsFields({
      ...autoSynced,
      harOverenskomst: false,
      overenskomstId: undefined,
    }, '2024-01-01');

    expect(result.fritvalgPct).toBe(autoSynced.fritvalgPct);
    expect(result.shSoPct).toBe(autoSynced.shSoPct);
    expect(result.storeBededagPct).toBe(autoSynced.storeBededagPct);
    expect(result.pensionPct).toBe(autoSynced.pensionPct);
  });

  it('låser bygge-/anlægsoverenskomstens fritvalg, SH/SO og pension feltvist', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'fritvalgPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'shSoPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'pensionPct')).toBe(true);
  });

  it('låser ikke KL-overenskomstens fritvalg, SH/SO og pension felter', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'fritvalgPct')).toBe(false);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'shSoPct')).toBe(false);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'pensionPct')).toBe(false);
  });

  it('bevarer brugerens værdi når der skiftes til en overenskomst med frit redigerbart felt', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
      shSoPct: 4.25,
      pensionPct: 9,
    }, '2024-01-01');

    expect(result.fritvalgPct).toBe(3.5);
    expect(result.shSoPct).toBe(4.25);
    expect(result.pensionPct).toBe(9);
  });

  it('bevarer brugerens frie satser ved cross-tab resync når reguleringsdato ændres på en ulåst offentlig overenskomst', () => {
    const beforeDateChange = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
      shSoPct: 4.25,
      pensionPct: 9,
    };

    const result = applyAutoSatsFields(beforeDateChange, '2025-01-01');

    expect(result.fritvalgPct).toBe(3.5);
    expect(result.shSoPct).toBe(4.25);
    expect(result.pensionPct).toBe(9);
  });

  it('låser lærer-overenskomstens fritvalg og pension, men ikke SH/SO', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'laerer-overenskomsten',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'fritvalgPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'pensionPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, '2024-01-01', 'shSoPct')).toBe(false);
  });

  it('overskriver tidligere brugerinput med 0 når ny overenskomst låser feltet til 0', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
    }, '2024-01-01');

    expect(result.fritvalgPct).toBe(0);
  });

  it('opdaterer kun de auto-låste satser ved cross-tab resync når reguleringsdato ændres', () => {
    const beforeDateChange = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      feriePct: 12.5,
      fritvalgPct: 99,
      shSoPct: 99,
      pensionPct: 99,
    }, '2023-03-01');

    const result = applyAutoSatsFields(beforeDateChange, '2024-01-01');

    expect(result.feriePct).toBe(12.5);
    expect(result.fritvalgPct).toBe(0);
    expect(result.shSoPct).toBeCloseTo(7, 10);
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('bygger satssegmenter med segmentdatoens overenskomstsats selv når særlig fra-dato er ældre', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'SH-udbetaling' as const,
      },
      skadedato: undefined,
      fra: '2024-01-01',
      til: '2024-03-31',
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.fra).toBe('2024-01-01');
    expect(segments[0]?.satser.shSoPct).toBeCloseTo(12.9, 10);
    expect(segments[1]?.fra).toBe('2024-03-01');
    expect(segments[1]?.satser.shSoPct).toBeCloseTo(14.7, 10);
  });

  it('bygger Almindelig løn-segmenter med den korrekt reducerede SH/SO-sats pr. segmentdato', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Almindelig løn' as const,
      },
      skadedato: undefined,
      fra: '2024-01-01',
      til: '2024-03-31',
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.fra).toBe('2024-01-01');
    expect(segments[0]?.satser.shSoPct).toBeCloseTo(7, 10);
    expect(segments[1]?.fra).toBe('2024-03-01');
    expect(segments[1]?.satser.shSoPct).toBeCloseTo(8.8, 10);
  });
});
