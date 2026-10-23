import {
  buildOffentligOverenskomstFormulaComponents,
  buildPrivateOverenskomstFormulaComponents,
  resolveAnciennitetForIndex,
} from '../../../domain/erstatningsopgoerelse/engines/overenskomstReguleringShared';
import type { OverenskomstPeriodeSats } from '../../../data/overenskomstRates';
import type { OffentligLoenType } from '../../../data/offentligLoenTypes';
import type { DanishDateString, ISODateString } from '../../../types/branded';

const iso = (v: string): ISODateString => v as ISODateString;

// bygge-anlaeg angiver grundlønnen pr. time (privat overenskomst).
const OVERENSKOMST = 'bygge-anlaeg';

const danish = (v: string): DanishDateString => v as DanishDateString;

const createSats = (overrides: Partial<OverenskomstPeriodeSats> = {}): OverenskomstPeriodeSats => ({
  fraDato: danish('01-01-2024'),
  grundloen: 100,
  shSoSats: null,
  fritvalg: null,
  agPension: null,
  sfgg: null,
  sfggFaglKbh: null,
  sfggFaglProv: null,
  sfggUfaglKbh: null,
  sfggUfaglProv: null,
  ...overrides,
});

const baseInput = () => ({
  harAnciennitetstillaeg: true as boolean | undefined,
  anciennitetstillaegDatoIso: iso('2024-06-01') as ISODateString | undefined,
  satsValue: 1000 as number | undefined,
  satsAngivesPer: 'Måned' as 'Time' | 'Måned' | undefined,
  overenskomstId: OVERENSKOMST as string | undefined,
  offentligLoenType: 'Månedsløn' as OffentligLoenType | undefined,
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
    // Håndregnet: 1.000 kr./måned ÷ 160,33 = 6,2371… → 6,24 kr./time (grundlønnens enhed).
    expect(result!.supplementValue).toBe(6.24);
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
    expect(resolveAnciennitetForIndex({ ...baseInput(), satsValue: Number.MAX_VALUE, satsAngivesPer: 'Time' })).toBeNull();
    expect(resolveAnciennitetForIndex({ ...baseInput(), overenskomstId: undefined })).toBeNull();
    expect(resolveAnciennitetForIndex({
      ...baseInput(),
      overenskomstId: 'ukendt-overenskomst',
    })).toBeNull();
  });

  it('bevarer en timesats i en timeangivet grundløn', () => {
    const result = resolveAnciennitetForIndex({ ...baseInput(), satsValue: 60, satsAngivesPer: 'Time' });
    expect(result).not.toBeNull();
    expect(result!.supplementValue).toBe(60);
  });

  it('bruger Måned som defensiv standard for satsens enhed', () => {
    const result = resolveAnciennitetForIndex({ ...baseInput(), satsAngivesPer: undefined });
    expect(result!.supplementValue).toBe(6.24);
  });

  it('privat overenskomst ignorerer en løntype – overenskomstens egen enhed gælder', () => {
    const result = resolveAnciennitetForIndex({ ...baseInput(), offentligLoenType: 'maanedsLoen' });
    expect(result!.supplementValue).toBe(6.24);
  });

  // Afklaringslog 10a: offentlig pakkes enhed er «Ansættelse», aldrig TAF-enheden (fund A2).
  // Håndregnede facitter: 500 kr./måned ÷ 160,33 = 3,1185… → 3,12; 3,50 kr./time × 160,33 = 561,155 → 561,16.
  it.each([
    ['kl-overenskomst', 'maanedsLoen', 500, 'Måned', 500],
    ['kl-overenskomst', 'timeLoen', 500, 'Måned', 3.12],
    ['kl-overenskomst', 'maanedsLoen', 3.5, 'Time', 561.16],
    ['kl-overenskomst', 'timeLoen', 3.5, 'Time', 3.5],
    ['rltn-overenskomst', 'maanedsLoen', 500, 'Måned', 500],
    ['rltn-overenskomst', 'timeLoen', 500, 'Måned', 3.12],
  ] as const)('%s, løntype %s: %s kr. pr. %s → %s kr. i pakkens enhed', (overenskomstId, offentligLoenType, satsValue, satsAngivesPer, expected) => {
    const result = resolveAnciennitetForIndex({
      ...baseInput(),
      overenskomstId,
      offentligLoenType,
      satsValue,
      satsAngivesPer,
    });

    expect(result).toEqual({
      activeFromIso: iso('2024-06-01'),
      supplementValue: expected,
    });
  });
});

describe('overenskomstens fælles formelkomponenter', () => {
  it('bygger offentlige komponenter med satser, inputfallback og Store Bededag', () => {
    expect(buildOffentligOverenskomstFormulaComponents({
      grundloen: 125,
      feriePct: 12,
      tillaegsSatser: createSats({ shSoSats: 0.0234, fritvalg: 0.0456, agPension: 0.1 }),
      shSoPctInput: 9,
      fritvalgPctInput: 8,
      pensionPctInput: 7,
      applyStoreBededagstillaeg: true,
      dateIso: iso('2024-01-01'),
    })).toEqual({
      baseValue: 125,
      feriePct: 12,
      fritvalgPct: 4.56,
      shSoPct: 2.34,
      pensionPct: 10,
      storeBededagPct: 0.45,
    });

    expect(buildOffentligOverenskomstFormulaComponents({
      grundloen: 125,
      feriePct: 12,
      tillaegsSatser: undefined,
      shSoPctInput: undefined,
      fritvalgPctInput: undefined,
      pensionPctInput: undefined,
      applyStoreBededagstillaeg: false,
      dateIso: iso('2023-12-31'),
    })).toEqual({
      baseValue: 125,
      feriePct: 12,
      fritvalgPct: 0,
      shSoPct: 0,
      pensionPct: 0,
      storeBededagPct: 0,
    });
  });

  it('bruger satsens egne procenter og input ved manglende sats', () => {
    const sats = createSats({ grundloen: 110, shSoSats: 0.02, fritvalg: 0.03, agPension: 0.04 });

    expect(buildPrivateOverenskomstFormulaComponents({
      sats,
      feriePct: 12,
      shSoPctInput: 8,
      fritvalgPctInput: 9,
      pensionPctInput: 10,
      dateIso: iso('2024-01-01'),
      baseValueSupplement: 5,
      applyStoreBededagstillaeg: true,
    })).toEqual({
      baseValue: 115,
      feriePct: 12,
      fritvalgPct: 3,
      shSoPct: 2,
      pensionPct: 4,
      storeBededagPct: 0.45,
    });

    expect(buildPrivateOverenskomstFormulaComponents({
      sats,
      feriePct: 12,
      shSoPctInput: 8,
      fritvalgPctInput: 9,
      pensionPctInput: 10,
      dateIso: iso('2023-12-31'),
      applyStoreBededagstillaeg: false,
    })).toEqual({
      baseValue: 110,
      feriePct: 12,
      fritvalgPct: 3,
      shSoPct: 2,
      pensionPct: 4,
      storeBededagPct: 0,
    });

    expect(buildPrivateOverenskomstFormulaComponents({
      sats: createSats({ grundloen: null }),
      feriePct: 0,
      shSoPctInput: undefined,
      fritvalgPctInput: undefined,
      pensionPctInput: undefined,
      dateIso: iso('2023-12-31'),
      applyStoreBededagstillaeg: false,
    }).baseValue).toBe(0);
  });
});
