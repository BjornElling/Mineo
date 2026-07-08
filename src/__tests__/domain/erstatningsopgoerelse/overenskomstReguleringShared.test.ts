import { resolveAnciennitetForIndex } from '../../../domain/erstatningsopgoerelse/engines/overenskomstReguleringShared';
import { convertAnciennitetSats } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { getGrundloenAngivetPerForOverenskomst } from '../../../data/overenskomstRates';
import { round2 } from '../../../utils/roundingShortcuts';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type { ISODateString } from '../../../types/branded';

const iso = (v: string): ISODateString => v as ISODateString;

const OVERENSKOMST = 'bygge-anlaeg';

const expectedSupplement = (value: number, per: 'Time' | 'Måned'): number => {
  const grundloenPer = getGrundloenAngivetPerForOverenskomst(OVERENSKOMST, 'Måneder');
  expect(grundloenPer).toBeDefined();
  return round2(convertAnciennitetSats(value, per, grundloenPer!));
};

const baseInput = () => ({
  harAnciennitetstillaeg: true as boolean | undefined,
  anciennitetstillaegDatoIso: iso('2024-06-01') as ISODateString | undefined,
  satsValue: 1000 as number | undefined,
  satsAngivesPer: 'Måned' as 'Time' | 'Måned' | undefined,
  overenskomstId: OVERENSKOMST as string | undefined,
  tafBeregningsenhed: TAF_BEREGNES_SOM.MAANEDER,
  anvendtReguleringsdatoIso: iso('2024-01-01') as ISODateString | undefined,
  periodeStartIso: iso('2024-01-01'),
  periodeEndIso: iso('2024-12-31'),
});

describe('resolveAnciennitetForIndex', () => {
  it('udleder tillæggets kroneværdi og aktiveringsdato for et aktivt tillæg', () => {
    const result = resolveAnciennitetForIndex(baseInput());
    expect(result).not.toBeNull();
    // Datoen ligger inden for perioden → ingen clamp.
    expect(result!.activeFromIso).toBe(iso('2024-06-01'));
    expect(result!.supplementValue).toBeCloseTo(expectedSupplement(1000, 'Måned'), 6);
    expect(result!.supplementValue).toBeGreaterThan(0);
  });

  it('clamper activeFromIso op til periodestart', () => {
    const result = resolveAnciennitetForIndex({
      ...baseInput(),
      anvendtReguleringsdatoIso: iso('2023-01-01'),
      anciennitetstillaegDatoIso: iso('2023-06-01'),
    });
    expect(result).not.toBeNull();
    expect(result!.activeFromIso).toBe(iso('2024-01-01'));
  });

  it('returnerer null når anciennitetsdatoen ligger efter periodens slutning', () => {
    const result = resolveAnciennitetForIndex({
      ...baseInput(),
      anciennitetstillaegDatoIso: iso('2025-01-01'),
    });
    expect(result).toBeNull();
  });

  it('returnerer null når anciennitetsdatoen ikke ligger efter anvendt reguleringsdato', () => {
    expect(resolveAnciennitetForIndex({
      ...baseInput(),
      anciennitetstillaegDatoIso: iso('2024-01-01'),
    })).toBeNull();
    expect(resolveAnciennitetForIndex({
      ...baseInput(),
      anciennitetstillaegDatoIso: iso('2023-12-31'),
    })).toBeNull();
  });

  it('returnerer null når tillægget ikke er slået til', () => {
    expect(resolveAnciennitetForIndex({ ...baseInput(), harAnciennitetstillaeg: false })).toBeNull();
  });

  it('returnerer null ved manglende dato, ikke-positiv sats eller manglende overenskomst', () => {
    expect(resolveAnciennitetForIndex({ ...baseInput(), anciennitetstillaegDatoIso: undefined })).toBeNull();
    expect(resolveAnciennitetForIndex({ ...baseInput(), satsValue: 0 })).toBeNull();
    expect(resolveAnciennitetForIndex({ ...baseInput(), satsValue: -50 })).toBeNull();
    expect(resolveAnciennitetForIndex({ ...baseInput(), overenskomstId: undefined })).toBeNull();
  });

  it('omregner timesats til grundlønnens enhed', () => {
    const result = resolveAnciennitetForIndex({ ...baseInput(), satsValue: 60, satsAngivesPer: 'Time' });
    expect(result).not.toBeNull();
    expect(result!.supplementValue).toBeCloseTo(expectedSupplement(60, 'Time'), 6);
  });
});
