import {
  applyAutoSatsFields,
  hasLockedOverenskomstSatser,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

describe('loenindkomstSatser', () => {
  it('fastsætter overenskomststyrede satser ud fra særlig fra-dato når skadesdato mangler', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      saerligFraDatoRegulering: '2024-01-01' as const,
      fritvalgPct: undefined,
      shSoPct: undefined,
      storeBededagPct: undefined,
      pensionPct: undefined,
    };

    const result = applyAutoSatsFields(ansaettelsesforhold, undefined);

    expect(result.fritvalgPct).toBeUndefined();
    expect(result.shSoPct).toBeCloseTo(7, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
  });

  it('opdaterer Store Bededagstillæg når løn på helligdage ændres', () => {
    const base = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      saerligFraDatoRegulering: '2024-01-01' as const,
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    const withAlmindeligLoen = applyAutoSatsFields(base, undefined);
    const withShUdbetaling = applyAutoSatsFields({
      ...withAlmindeligLoen,
      loenPaaHelligdage: 'SH-udbetaling' as const,
    }, undefined);

    expect(withAlmindeligLoen.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(withShUdbetaling.storeBededagPct).toBe(0);
  });

  it('opdaterer Store Bededagstillæg når reguleringsdato flyttes over 01-01-2024-grænsen', () => {
    const base = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      saerligFraDatoRegulering: '2023-12-31' as const,
    };

    const beforeThreshold = applyAutoSatsFields(base, undefined);
    const afterThreshold = applyAutoSatsFields({
      ...beforeThreshold,
      saerligFraDatoRegulering: '2024-01-01' as const,
    }, undefined);

    expect(beforeThreshold.storeBededagPct).toBe(0);
    expect(afterThreshold.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('falder tilbage til skadesdato for Store Bededagstillæg når særlig fra-dato ryddes', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      saerligFraDatoRegulering: undefined,
    }, '2024-02-01');

    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('bevarer de sidst fastsatte satser når overenskomst fravælges igen', () => {
    const autoSynced = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      saerligFraDatoRegulering: '2024-01-01' as const,
    }, undefined);

    const result = applyAutoSatsFields({
      ...autoSynced,
      harOverenskomst: false,
      overenskomstId: undefined,
    }, undefined);

    expect(result.fritvalgPct).toBe(autoSynced.fritvalgPct);
    expect(result.shSoPct).toBe(autoSynced.shSoPct);
    expect(result.storeBededagPct).toBe(autoSynced.storeBededagPct);
    expect(result.pensionPct).toBe(autoSynced.pensionPct);
  });

  it('låser kun felterne når både overenskomst-toggle er valgt og en konkret overenskomst er sat', () => {
    expect(hasLockedOverenskomstSatser({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
    })).toBe(true);

    expect(hasLockedOverenskomstSatser({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: undefined,
    })).toBe(false);

    expect(hasLockedOverenskomstSatser({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: false,
      overenskomstId: 'bygge-anlaeg',
    })).toBe(false);
  });
});
