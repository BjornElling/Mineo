import {
  buildOffentligOverenskomstFormulaComponents,
  buildPrivateOverenskomstFormulaComponents,
  resolveAnciennitetForIndex,
  resolvePrivateOverenskomstBaseContext,
  type PrivateOverenskomstBaseContext,
} from '../../../domain/erstatningsopgoerelse/engines/overenskomstReguleringShared';
import { convertAnciennitetSats } from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import type { OverenskomstId, OverenskomstPeriodeSats } from '../../../data/overenskomstRates';
import { getGrundloenAngivetPerForOverenskomst } from '../../../data/overenskomstRates';
import { round2 } from '../../../utils/roundingShortcuts';
import { TAF_BEREGNES_SOM } from '../../../domain/erstatningsopgoerelse/helpers/tafBeregningsenhed';
import type { DanishDateString, ISODateString } from '../../../types/branded';

const iso = (v: string): ISODateString => v as ISODateString;

const OVERENSKOMST = 'bygge-anlaeg';
const OVERENSKOMST_ID = OVERENSKOMST as OverenskomstId;

const expectedSupplement = (value: number, per: 'Time' | 'Måned'): number => {
  const grundloenPer = getGrundloenAngivetPerForOverenskomst(OVERENSKOMST, 'Måneder');
  expect(grundloenPer).toBeDefined();
  return round2(convertAnciennitetSats(value, per, grundloenPer!));
};

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

const basePrivateContext = (useInputPctBasisForMissingBase: boolean): PrivateOverenskomstBaseContext => ({
  effectiveBase: {
    startIso: iso('2024-01-01'),
    sats: createSats({ grundloen: 100 }),
  },
  referenceSats: createSats({ shSoSats: 0.01 }),
  useInputPctBasisForMissingBase,
});

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
    expect(resolveAnciennitetForIndex({ ...baseInput(), satsValue: Number.MAX_VALUE, satsAngivesPer: 'Time' })).toBeNull();
    expect(resolveAnciennitetForIndex({ ...baseInput(), overenskomstId: undefined })).toBeNull();
    expect(resolveAnciennitetForIndex({
      ...baseInput(),
      overenskomstId: 'ukendt-overenskomst',
    })).toBeNull();
  });

  it('omregner timesats til grundlønnens enhed', () => {
    const result = resolveAnciennitetForIndex({ ...baseInput(), satsValue: 60, satsAngivesPer: 'Time' });
    expect(result).not.toBeNull();
    expect(result!.supplementValue).toBeCloseTo(expectedSupplement(60, 'Time'), 6);
  });

  it('bruger arbejdsdagegrenen og Måned som defensiv standard for satsens enhed', () => {
    const result = resolveAnciennitetForIndex({
      ...baseInput(),
      satsAngivesPer: undefined,
      tafBeregningsenhed: TAF_BEREGNES_SOM.ARBEJDSDAGE,
    });

    expect(result).not.toBeNull();
    expect(result!.supplementValue).toBeCloseTo(expectedSupplement(1000, 'Måned'), 6);
  });

  it('bevarer en månedssats i månedslønnen for offentlig overenskomst', () => {
    const result = resolveAnciennitetForIndex({
      ...baseInput(),
      overenskomstId: 'kl-overenskomst',
      satsValue: 1000,
      satsAngivesPer: 'Måned',
    });

    expect(result).toEqual({
      activeFromIso: iso('2024-06-01'),
      supplementValue: 1000,
    });
  });
});

describe('resolvePrivateOverenskomstBaseContext', () => {
  const baseArgs = () => ({
    overenskomstId: OVERENSKOMST_ID,
    anvendtReguleringsdato: iso('2024-01-01'),
    effectiveReguleringsdato: iso('2024-01-01'),
    applyAlmindeligLoenPaaShDageRegel: false,
    shSoPctInput: undefined,
    fritvalgPctInput: undefined,
    pensionPctInput: undefined,
  });

  it('returnerer den effektive sats og en eksisterende referencesats for en dækket dato', () => {
    const result = resolvePrivateOverenskomstBaseContext(baseArgs());

    expect(result).not.toBeNull();
    expect(result?.effectiveBase.startIso).toBe(iso('2024-01-01'));
    expect(result?.effectiveBase.sats.grundloen).toBe(138.15);
    expect(result?.referenceSats?.grundloen).toBe(138.15);
    expect(result?.useInputPctBasisForMissingBase).toBe(false);
  });

  it('falder tilbage til første sats og bruger inputbasis når datoen ligger før dækningen', () => {
    const result = resolvePrivateOverenskomstBaseContext({
      ...baseArgs(),
      anvendtReguleringsdato: iso('2000-01-01'),
      effectiveReguleringsdato: iso('2000-01-01'),
      shSoPctInput: 2,
    });

    expect(result).not.toBeNull();
    expect(result?.effectiveBase.startIso).toBe(iso('2011-03-01'));
    expect(result?.effectiveBase.sats.grundloen).toBe(112.5);
    expect(result?.referenceSats).toBeUndefined();
    expect(result?.useInputPctBasisForMissingBase).toBe(true);

    const pensionOnlyInput = resolvePrivateOverenskomstBaseContext({
      ...baseArgs(),
      anvendtReguleringsdato: iso('2000-01-01'),
      effectiveReguleringsdato: iso('2000-01-01'),
      shSoPctInput: 0,
      pensionPctInput: 3,
    });
    expect(pensionOnlyInput?.useInputPctBasisForMissingBase).toBe(true);
  });

  it('returnerer null for ugyldig effektiv dato eller ukendt overenskomst', () => {
    const missingReferenceDate = resolvePrivateOverenskomstBaseContext({
      ...baseArgs(),
      anvendtReguleringsdato: iso('ikke-en-dato'),
    });
    expect(missingReferenceDate?.effectiveBase.startIso).toBe(iso('2024-01-01'));
    expect(missingReferenceDate?.referenceSats).toBeUndefined();

    expect(resolvePrivateOverenskomstBaseContext({
      ...baseArgs(),
      effectiveReguleringsdato: iso('ikke-en-dato'),
    })).toBeNull();

    expect(resolvePrivateOverenskomstBaseContext({
      ...baseArgs(),
      overenskomstId: 'ukendt-overenskomst' as OverenskomstId,
    })).toBeNull();
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

  it('bruger reference- eller segmentsatser efter pctbasisrollen', () => {
    const sats = createSats({ grundloen: 110, shSoSats: 0.02, fritvalg: 0.03, agPension: 0.04 });
    const context = basePrivateContext(true);

    expect(buildPrivateOverenskomstFormulaComponents({
      sats,
      context,
      feriePct: 12,
      shSoPctInput: 8,
      fritvalgPctInput: 9,
      pensionPctInput: 10,
      pctBasisRole: 'reference',
      dateIso: iso('2024-01-01'),
      baseValueSupplement: 5,
      applyStoreBededagstillaeg: true,
    })).toEqual({
      baseValue: 115,
      feriePct: 12,
      fritvalgPct: 9,
      shSoPct: 1,
      pensionPct: 10,
      storeBededagPct: 0.45,
    });

    expect(buildPrivateOverenskomstFormulaComponents({
      sats,
      context: basePrivateContext(false),
      feriePct: 12,
      shSoPctInput: 8,
      fritvalgPctInput: 9,
      pensionPctInput: 10,
      pctBasisRole: 'segment',
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
      context: basePrivateContext(false),
      feriePct: 0,
      shSoPctInput: undefined,
      fritvalgPctInput: undefined,
      pensionPctInput: undefined,
      pctBasisRole: 'segment',
      dateIso: iso('2023-12-31'),
      applyStoreBededagstillaeg: false,
    }).baseValue).toBe(0);
  });
});
