import {
  applyAutoSatsFields,
  buildLoenindkomstRateSegments,
  isOverenskomstSatsFieldLocked,
  resolveAutoStoreBededagPct,
  syncManualBaseRowSatser,
} from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstSatser';
import { createDefaultLoenindkomstAnsaettelsesforhold } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

// ─── syncManualBaseRowSatser ──────────────────────────────────────────────────

describe('syncManualBaseRowSatser', () => {
  const makeManualAf = (tillaegAngivesSom: 'procent' | 'beloeb') => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
    tillaegAngivesSom,
    feriePct: 12.5,
    fritvalgPct: 4,
    shSoPct: 1.5,
    pensionPct: 12,
    loenudviklingManuelTableData: [
      { id: 'base', dato: undefined, grundloen: undefined, feriepenge: 99, shSoSats: 99, fritvalg: 99, agPension: 99 },
    ],
  });

  it('spejler satsfelterne ind i basisrækken i Procent-tilstand', () => {
    const result = syncManualBaseRowSatser(makeManualAf('procent'));
    const baseRow = result.loenudviklingManuelTableData?.[0];
    expect(baseRow?.feriepenge).toBe(12.5);
    expect(baseRow?.shSoSats).toBe(1.5);
    expect(baseRow?.fritvalg).toBe(4);
    expect(baseRow?.agPension).toBe(12);
  });

  it('spejler satsfelterne ind i basisrækken også i Beløb-tilstand', () => {
    // Satsfelterne vises og er reguleringens fælles kilde i begge tillægs-tilstande
    // (2026-07-02: Beløb-neutraliseringen fjernet), så basisrækken spejler dem altid.
    const result = syncManualBaseRowSatser(makeManualAf('beloeb'));
    const baseRow = result.loenudviklingManuelTableData?.[0];
    expect(baseRow?.feriepenge).toBe(12.5);
    expect(baseRow?.shSoSats).toBe(1.5);
    expect(baseRow?.fritvalg).toBe(4);
    expect(baseRow?.agPension).toBe(12);
  });

  it('rører ikke ansættelsesforhold uden manuelt angivet lønudvikling', () => {
    const af = { ...createDefaultLoenindkomstAnsaettelsesforhold(), loenudviklingBeregningsgrundlag: 'Overenskomst' as const };
    expect(syncManualBaseRowSatser(af)).toBe(af);
  });
});

// ─── resolveAutoStoreBededagPct ───────────────────────────────────────────────

describe('resolveAutoStoreBededagPct', () => {
  const almindelig = { loenPaaHelligdage: 'Almindelig løn' as const };
  const shUdbetaling = { loenPaaHelligdage: 'SH-udbetaling' as const };

  it('returnerer 0,45 ved Almindelig løn og dato = 2024-01-01', () => {
    expect(resolveAutoStoreBededagPct(almindelig, toISODateString('2024-01-01'))).toBe(0.45);
  });

  it('returnerer 0,45 ved Almindelig løn og dato efter 2024-01-01', () => {
    expect(resolveAutoStoreBededagPct(almindelig, toISODateString('2025-06-15'))).toBe(0.45);
  });

  it('returnerer 0 ved Almindelig løn og dato = 2023-12-31 (dagen før grænsen)', () => {
    expect(resolveAutoStoreBededagPct(almindelig, toISODateString('2023-12-31'))).toBe(0);
  });

  it('returnerer 0 ved SH-udbetaling og dato >= 2024-01-01', () => {
    expect(resolveAutoStoreBededagPct(shUdbetaling, toISODateString('2024-01-01'))).toBe(0);
    expect(resolveAutoStoreBededagPct(shUdbetaling, toISODateString('2025-01-01'))).toBe(0);
  });

  it('returnerer 0 når reguleringsdato er undefined', () => {
    expect(resolveAutoStoreBededagPct(almindelig, undefined)).toBe(0);
  });
});

// ─── applyAutoSatsFields — Store Bededag ─────────────────────────────────────

describe('applyAutoSatsFields — Store Bededag', () => {
  const base = () => ({
    ...createDefaultLoenindkomstAnsaettelsesforhold(),
    harOverenskomst: true,
    overenskomstId: 'bygge-anlaeg',
    loenPaaHelligdage: 'Almindelig løn' as const,
  });

  it('sætter 0,45 % ved Almindelig løn og reguleringsdato = 2024-01-01', () => {
    expect(applyAutoSatsFields(base(), toISODateString('2024-01-01')).storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('sætter 0 % ved Almindelig løn og reguleringsdato = 2023-12-31 (dagen før grænsen)', () => {
    expect(applyAutoSatsFields(base(), toISODateString('2023-12-31')).storeBededagPct).toBe(0);
  });

  it('sætter 0 % ved SH-udbetaling selvom reguleringsdato er >= 2024-01-01', () => {
    const result = applyAutoSatsFields(
      { ...base(), loenPaaHelligdage: 'SH-udbetaling' as const },
      toISODateString('2024-01-01')
    );
    expect(result.storeBededagPct).toBe(0);
  });

  it('sætter 0 % når reguleringsdato er undefined', () => {
    expect(applyAutoSatsFields(base(), undefined).storeBededagPct).toBe(0);
  });

  it('overrider stale storeBededagPct fra tidligere sync når loenPaaHelligdage skifter til SH-udbetaling', () => {
    const staleSats = { ...base(), loenPaaHelligdage: 'SH-udbetaling' as const, storeBededagPct: 0.45 };
    expect(applyAutoSatsFields(staleSats, toISODateString('2024-06-01')).storeBededagPct).toBe(0);
  });

  it('fastsætter øvrige overenskomstsatser korrekt sammen med bededagstillæg', () => {
    const result = applyAutoSatsFields(
      { ...base(), fritvalgPct: undefined, shSoPct: undefined, storeBededagPct: undefined, pensionPct: undefined },
      toISODateString('2024-01-01')
    );
    expect(result.fritvalgPct).toBe(0);
    expect(result.shSoPct).toBeCloseTo(7, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
  });

  it('opdaterer bededagssats korrekt ved cross-tab resync fra dato før til dato efter grænsen', () => {
    const beforeDateChange = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      feriePct: 12.5,
      fritvalgPct: 99,
      shSoPct: 99,
      pensionPct: 99,
    }, toISODateString('2023-03-01'));

    expect(beforeDateChange.storeBededagPct).toBe(0);

    const result = applyAutoSatsFields(beforeDateChange, toISODateString('2024-01-01'));

    expect(result.feriePct).toBe(12.5);
    expect(result.fritvalgPct).toBe(0);        // låst af bygge-anlaeg
    expect(result.shSoPct).toBeCloseTo(7, 10); // låst af bygge-anlaeg
    expect(result.pensionPct).toBeCloseTo(10.15, 10);
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('beholder bededagssats korrekt når overenskomst fravælges (harOverenskomst: false)', () => {
    // storeBededagPct styres af loenPaaHelligdage + dato — ikke af harOverenskomst
    const autoSynced = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    }, toISODateString('2024-01-01'));

    const result = applyAutoSatsFields({
      ...autoSynced,
      harOverenskomst: false,
      overenskomstId: undefined,
    }, toISODateString('2024-01-01'));

    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });
});

// ─── applyAutoSatsFields — overenskomstsatser ─────────────────────────────────

describe('applyAutoSatsFields — overenskomstsatser', () => {
  it('bevarer brugerens frie satser ved ulåst offentlig overenskomst (KL)', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
      shSoPct: 4.25,
      pensionPct: 9,
    }, toISODateString('2024-01-01'));

    expect(result.fritvalgPct).toBe(3.5);
    expect(result.shSoPct).toBe(4.25);
    expect(result.pensionPct).toBe(9);
  });

  it('bevarer brugerens frie satser ved cross-tab resync på ulåst overenskomst', () => {
    const beforeDateChange = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
      shSoPct: 4.25,
      pensionPct: 9,
    };

    const result = applyAutoSatsFields(beforeDateChange, toISODateString('2025-01-01'));

    expect(result.fritvalgPct).toBe(3.5);
    expect(result.shSoPct).toBe(4.25);
    expect(result.pensionPct).toBe(9);
    // bededag sættes korrekt selvom øvrige satser er brugerredigerede
    expect(result.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('overskriver brugerinput med 0 når overenskomst låser feltet til 0', () => {
    const result = applyAutoSatsFields({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      fritvalgPct: 3.5,
    }, toISODateString('2024-01-01'));

    expect(result.fritvalgPct).toBe(0);
  });
});

// ─── isOverenskomstSatsFieldLocked ───────────────────────────────────────────

describe('isOverenskomstSatsFieldLocked', () => {
  it('låser bygge-/anlægsoverenskomstens fritvalg, SH/SO og pension', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'fritvalgPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'shSoPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'pensionPct')).toBe(true);
  });

  it('låser ikke KL-overenskomstens fritvalg, SH/SO og pension', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'fritvalgPct')).toBe(false);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'shSoPct')).toBe(false);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'pensionPct')).toBe(false);
  });

  it('låser lærer-overenskomstens fritvalg og pension, men ikke SH/SO', () => {
    const af = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'laerer-overenskomsten',
      loenPaaHelligdage: 'Almindelig løn' as const,
    };

    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'fritvalgPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'pensionPct')).toBe(true);
    expect(isOverenskomstSatsFieldLocked(af, toISODateString('2024-01-01'), 'shSoPct')).toBe(false);
  });
});

// ─── buildLoenindkomstRateSegments ────────────────────────────────────────────

describe('buildLoenindkomstRateSegments — Store Bededag', () => {
  it('ingen overenskomst: udleder bededagssats direkte fra segmentdatoen uden upstream auto-sync', () => {
    // Tester den svagt koblede sti (ingen overenskomst, ikke manuelt) i loenindkomstSatser.ts
    // Her hentes storeBededagPct via resolveStoreBededagPct(af, segment.startDato), ikke fra af.storeBededagPct
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenPaaHelligdage: 'Almindelig løn' as const,
        storeBededagPct: undefined, // ikke auto-synced fra upstream
      },
      skadedato: undefined,
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-01-01'),
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.satser.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('ingen overenskomst: sætter 0 for dato inden grænsen selvom storeBededagPct er sat i af', () => {
    // Bekræfter at resolveStoreBededagPct bruger segmentdato, ikke af.storeBededagPct
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenPaaHelligdage: 'Almindelig løn' as const,
        storeBededagPct: 0.45, // stale/forkert værdi
      },
      skadedato: undefined,
      fra: toISODateString('2023-06-01'),
      til: toISODateString('2023-12-31'),
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.satser.storeBededagPct).toBe(0);
  });

  it('manuelt angivet: segmentgrænse ved dato-rækker inden for interval — bededag sættes fra segmentdato', () => {
    // dato-feltet i loenudviklingManuelTableData forventes som ISODateString inden for [fra, til]
    // 2024-01-01 er inden for [2023-10-01, 2024-03-31] → splitter her
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenPaaHelligdage: 'Almindelig løn' as const,
        storeBededagPct: undefined,
        loenudviklingManuelTableData: [
          { id: 'manuel-1', dato: toISODateString('2024-01-01'), feriepenge: 12.5, shSoSats: 6.9, fritvalg: 0, agPension: 10 },
        ],
      },
      skadedato: undefined,
      fra: toISODateString('2023-10-01'),
      til: toISODateString('2024-03-31'),
    });

    // Segment for 2023-10-01 til 2023-12-31 → bededagssats = 0 (dato < 2024-01-01)
    const segmentFoer2024 = segments.find((s) => s.fra < toISODateString('2024-01-01'));
    // Segment fra 2024-01-01 → bededagssats = 0,45
    const segmentEfter2024 = segments.find((s) => s.fra >= toISODateString('2024-01-01'));

    expect(segmentFoer2024).toBeDefined();
    expect(segmentFoer2024?.satser.storeBededagPct).toBe(0);

    expect(segmentEfter2024).toBeDefined();
    expect(segmentEfter2024?.satser.storeBededagPct).toBeCloseTo(0.45, 10);
  });

  it('manuelt angivet: bruger senest gældende pensionssats selv når ændringen ligger før lønrækken', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: false,
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenPaaHelligdage: 'Almindelig løn' as const,
        feriePct: 15,
        pensionPct: 10,
        loenudviklingManuelTableData: [
          { id: 'manuel-1', dato: toISODateString('2025-02-28'), feriepenge: 15.00, shSoSats: undefined, fritvalg: undefined, agPension: 10.00 },
          { id: 'manuel-2', dato: toISODateString('2025-03-01'), feriepenge: 15.00, shSoSats: undefined, fritvalg: undefined, agPension: 10.00 },
          { id: 'manuel-3', dato: toISODateString('2025-05-01'), feriepenge: 15.00, shSoSats: undefined, fritvalg: undefined, agPension: 12.00 },
          { id: 'manuel-4', dato: toISODateString('2026-03-01'), feriepenge: 15.00, shSoSats: undefined, fritvalg: undefined, agPension: 12.00 },
        ],
      },
      skadedato: undefined,
      fra: toISODateString('2025-06-01'),
      til: toISODateString('2025-06-30'),
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]?.fra).toBe(toISODateString('2025-06-01'));
    expect(segments[0]?.til).toBe(toISODateString('2025-06-30'));
    expect(segments[0]?.satser.feriePct).toBe(15);
    expect(segments[0]?.satser.pensionPct).toBe(12);
  });

  it('overenskomst (bygge-anlaeg, SH-udbetaling): sætter aldrig bededagstillæg', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'SH-udbetaling' as const,
      },
      skadedato: undefined,
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-03-31'),
    });

    for (const segment of segments) {
      expect(segment.satser.storeBededagPct).toBe(0);
    }
  });

  it('overenskomst (bygge-anlaeg, Almindelig løn): alle segmenter fra 2024-01-01 har bededagstillæg', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Almindelig løn' as const,
      },
      skadedato: undefined,
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-03-31'),
    });

    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(segment.satser.storeBededagPct).toBeCloseTo(0.45, 10);
    }
  });

  it('overenskomst (bygge-anlaeg, Almindelig løn): reduceret SH/SO-sats pr. segmentdato', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'Almindelig løn' as const,
      },
      skadedato: undefined,
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-03-31'),
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.fra).toBe(toISODateString('2024-01-01'));
    expect(segments[0]?.satser.shSoPct).toBeCloseTo(7, 10);
    expect(segments[1]?.fra).toBe(toISODateString('2024-03-01'));
    expect(segments[1]?.satser.shSoPct).toBeCloseTo(8.8, 10);
  });

  it('overenskomst (bygge-anlaeg, SH-udbetaling): fuld SH/SO-sats pr. segmentdato', () => {
    const segments = buildLoenindkomstRateSegments({
      ansaettelsesforhold: {
        ...createDefaultLoenindkomstAnsaettelsesforhold(),
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        loenPaaHelligdage: 'SH-udbetaling' as const,
      },
      skadedato: undefined,
      fra: toISODateString('2024-01-01'),
      til: toISODateString('2024-03-31'),
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]?.fra).toBe(toISODateString('2024-01-01'));
    expect(segments[0]?.satser.shSoPct).toBeCloseTo(12.9, 10);
    expect(segments[1]?.fra).toBe(toISODateString('2024-03-01'));
    expect(segments[1]?.satser.shSoPct).toBeCloseTo(14.7, 10);
  });
});
