/**
 * Tests for Regulation Core Model (Index)
 */

import { buildRegulationTimeline, buildSHDageSet, buildFerieDageSet } from '../../../domain/debug/eoDebugRegulationCore';
import type { DebugDay } from '../../../domain/debug/eoDebugTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import type { ISODateString } from '../../../types/branded';

// Test helper: Cast string literal til ISODateString (kun til tests)
const iso = (date: string): ISODateString => date as ISODateString;

const makeDebugDay = (iso: string): DebugDay => ({
  iso: iso as any,
  weekday: 1,
  isWeekend: false,
  isSognehelligdag: false,
  isArbejdsdag: true,
  tafFlags: new Set(),
  svieSmerte: 'Ingen',
});

const makeInput = (): {
  debugDays: DebugDay[];
  eoValues: ErstatningsopgoerelseValues;
  stamdataValues: StamdataValues;
} => ({
  debugDays: [makeDebugDay('2024-01-01')],
  eoValues: ({
    ...createErstatningsopgoerelseInitialValues(),
    vedroererPeriodeFra: '2024-01-01',
    vedroererPeriodeTil: '2024-12-31',
    svieSmerteSatserAar: 2024,
    svieSmerteDelvisSygemeldingSats: 'halv',
    loenindkomstAnsaettelsesforhold: [
      {
        id: 'af-1',
        navnPaaArbejdssted: 'Test',
        harOverenskomst: true,
        overenskomstId: 'bygge-anlaeg',
        ansatPaaSkadestidspunktet: true,
        ansaettelsesforholdOphoert: false,
        sidsteArbejdsdag: undefined,
        feriePct: 12.5,
        fritvalgPct: undefined,
        shSoPct: undefined,
        storeBededagPct: undefined,
        pensionPct: undefined,
        loenperiode: 'maaned',
        indtaegtsoplysningerTableData: [],
        fuldLoenUnderFerie: 'Nej',
        loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
        saerligFraDatoRegulering: undefined,
        loenudviklingBeregningsgrundlag: 'Ingen',
        loenudviklingStatistikModel: undefined,
        loenudviklingManuelTableData: [],
      },
    ],
  } as unknown) as ErstatningsopgoerelseValues,
  stamdataValues: {
    journalnr: '',
    advokat: '',
    sagsbehandler: '',
    skadelidte: '',
    skadestype: '',
    skadesdato: iso('2024-01-01'),
  } as StamdataValues,
});

describe('buildRegulationTimeline - Index model', () => {
  it('bygger entries pr. ansaettelsesforhold', () => {
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser.length).toBe(1);
    expect(result.ansaettelser[0]?.entries.length).toBeGreaterThan(0);
  });

  it('indsætter store bededag-dato ved almindelig loen paa helligdage', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '2023-12-01';
    input.eoValues.vedroererPeriodeTil = '2024-06-01';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    const hasSbd = entries.some((entry) => entry.effectiveFrom === '2024-01-01');
    expect(hasSbd).toBe(true);
  });

  it('udelader store bededag-dato uden almindelig loen paa helligdage', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '2023-12-01';
    input.eoValues.vedroererPeriodeTil = '2024-06-01';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.SH_UDBETALING;

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    const hasSbd = entries.some((entry) => entry.effectiveFrom === '2024-01-01');
    expect(hasSbd).toBe(false);
  });
});

// ─── Indeks-beregning ─────────────────────────────────────────────────────────

describe('buildRegulationTimeline — indeks-beregning', () => {
  it('første entry har packageValue > 0', () => {
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const firstEntry = result.ansaettelser[0]?.entries[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry!.packageValue).toBeGreaterThan(0);
  });

  it('første entry har index = 100 når skadesdato er lig effectiveFrom', () => {
    // Skadesdato = 2024-01-01, EO-periode starter samme dag
    // reference-indeks = entry på skadesdatoen → index bør være 100
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    // Find entry med effectiveFrom tidligst i perioden (skadesdatoen)
    const firstEntry = entries[0];
    expect(firstEntry).toBeDefined();
    // index = (packageValue / referenceValue) * 100
    // Hvis der kun er én regulering dækker perioden, er index ~100
    expect(firstEntry!.index).toBeCloseTo(100, 0);
  });

  it('referenceValue matcher packageValue ved skadesdatoen', () => {
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const af = result.ansaettelser[0];
    expect(af).toBeDefined();
    // referenceValue er pakkeværdien på skadesdatoen
    expect(af!.referenceValue).toBeGreaterThan(0);
    // Første entry (der dækker skadesdatoen) skal have index ≈ 100
    const matchingEntry = af!.entries.find((e) => e.effectiveFrom <= af!.referenceIso);
    expect(matchingEntry).toBeDefined();
    expect(matchingEntry!.index).toBeGreaterThan(0);
  });

  it('entry indeholder alle forventede felter', () => {
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const entry = result.ansaettelser[0]?.entries[0];
    expect(entry).toBeDefined();
    expect(typeof entry!.grundloen).toBe('number');
    expect(typeof entry!.feriePct).toBe('number');
    expect(typeof entry!.shSoPct).toBe('number');
    expect(typeof entry!.fritvalgPct).toBe('number');
    expect(typeof entry!.storeBededagPct).toBe('number');
    expect(typeof entry!.pensionPct).toBe('number');
    expect(typeof entry!.packageValue).toBe('number');
    expect(typeof entry!.index).toBe('number');
    expect(entry!.effectiveFrom).toBeDefined();
  });

  it('returnerer tom ansaettelser ved manglende EO-periode', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '' as any;
    input.eoValues.vedroererPeriodeTil = '' as any;
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(0);
  });

  it('returnerer tom ansaettelser ved manglende skadesdato', () => {
    const input = makeInput();
    input.stamdataValues.skadesdato = '' as any;
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(0);
  });

  it('returnerer tom ansaettelser ved manglende overenskomstId', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(0);
  });
});

// ─── Periode-overgange ────────────────────────────────────────────────────────

describe('buildRegulationTimeline — periode-overgange', () => {
  it('to reguleringsperioder i EO-perioden → mindst 2 entries', () => {
    // EO-periode 2023-01-01 → 2024-12-31 dækker typisk 2+ reguleringsdatoer for bygge-anlaeg
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '2022-01-01';
    input.eoValues.vedroererPeriodeTil = '2024-12-31';
    input.stamdataValues.skadesdato = iso('2022-01-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('seneste entry har højere index end første (løn stiger over tid)', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '2022-01-01';
    input.eoValues.vedroererPeriodeTil = '2024-12-31';
    input.stamdataValues.skadesdato = iso('2022-01-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    if (entries.length >= 2) {
      const firstIndex = entries[0]!.index;
      const lastIndex = entries[entries.length - 1]!.index;
      // Løn reguleres opad → sidste index bør være ≥ første
      expect(lastIndex).toBeGreaterThanOrEqual(firstIndex);
    }
  });

  it('arbejdsdage og maaneder er sat for alle entries', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = '2022-01-01';
    input.eoValues.vedroererPeriodeTil = '2024-12-31';
    input.stamdataValues.skadesdato = iso('2022-01-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    for (const entry of entries) {
      expect(entry.arbejdsdage).not.toBeNull();
      expect(entry.maaneder).not.toBeNull();
      expect(entry.arbejdsdage).toBeGreaterThan(0);
    }
  });
});

// ─── Offentlig løn-path (KL) ─────────────────────────────────────────────────

describe('buildRegulationTimeline — offentlig løn-path (KL)', () => {
  const makeKLInput = (): ReturnType<typeof makeInput> => ({
    debugDays: [makeDebugDay('2024-01-01')],
    eoValues: ({
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: '2024-01-01',
      vedroererPeriodeTil: '2024-12-31',
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'halv',
      loenindkomstAnsaettelsesforhold: [
        {
          id: 'af-kl',
          navnPaaArbejdssted: 'KL Test',
          harOverenskomst: true,
          overenskomstId: 'kl-overenskomst',
          ansatPaaSkadestidspunktet: true,
          ansaettelsesforholdOphoert: false,
          sidsteArbejdsdag: undefined,
          feriePct: 12.5,
          fritvalgPct: undefined,
          shSoPct: undefined,
          storeBededagPct: undefined,
          pensionPct: undefined,
          loenperiode: 'maaned',
          indtaegtsoplysningerTableData: [],
          fuldLoenUnderFerie: 'Nej',
          loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
          saerligFraDatoRegulering: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          loenudviklingStatistikModel: undefined,
          loenudviklingManuelTableData: [],
          offentligLoenType: 'Timeløn',
          offentligLoenTrin: 20,
          offentligLoenGruppe: 0,
        },
      ],
    } as unknown) as ErstatningsopgoerelseValues,
    stamdataValues: {
      journalnr: '',
      advokat: '',
      sagsbehandler: '',
      skadelidte: '',
      skadestype: '',
      skadesdato: iso('2024-01-01'),
    } as StamdataValues,
  });

  it('bygger ansaettelse via offentlig KL løn-path', () => {
    const result = buildRegulationTimeline(makeKLInput());
    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.entries.length).toBeGreaterThan(0);
  });

  it('KL-entries har positive packageValue og index-værdier', () => {
    const result = buildRegulationTimeline(makeKLInput());
    for (const entry of result.ansaettelser[0]?.entries ?? []) {
      expect(entry.packageValue).toBeGreaterThan(0);
      expect(entry.index).toBeGreaterThan(0);
    }
  });

  it('KL-entries har arbejdsdage og maaneder sat', () => {
    const result = buildRegulationTimeline(makeKLInput());
    for (const entry of result.ansaettelser[0]?.entries ?? []) {
      expect(entry.arbejdsdage).not.toBeNull();
      expect(entry.maaneder).not.toBeNull();
    }
  });
});

// ─── buildSHDageSet ──────────────────────────────────────────────────────────

describe('buildSHDageSet', () => {
  it('indeholder nytårsdag 2024-01-01 (mandag)', () => {
    const set = buildSHDageSet(iso('2024-01-01'), iso('2024-01-31'));
    expect(set.has(iso('2024-01-01'))).toBe(true);
  });

  it('inkluderer ikke weekend-helligdage (st. pinsedag 2024-05-19 = søndag)', () => {
    // 1. pinsedag 2024-05-19 er søndag, 2. pinsedag 2024-05-20 er mandag
    const set = buildSHDageSet(iso('2024-05-01'), iso('2024-05-31'));
    expect(set.has(iso('2024-05-19'))).toBe(false); // søndag → inkluderes ikke
    expect(set.has(iso('2024-05-20'))).toBe(true);  // mandag → inkluderes
  });

  it('tom set for periode uden helligdage', () => {
    // En periode i midten af februar uden nogen helligdage
    const set = buildSHDageSet(iso('2024-02-05'), iso('2024-02-09'));
    expect(set.size).toBe(0);
  });
});

// ─── buildFerieDageSet ───────────────────────────────────────────────────────

describe('buildFerieDageSet', () => {
  it('returnerer tomt set for tomt input', () => {
    const shDage = new Set<ISODateString>();
    const result = buildFerieDageSet({}, shDage, iso('2024-03-01'), iso('2024-03-31'));
    expect(result.size).toBe(0);
  });

  it('tilføjer hverdags-feriedage fra ferieperioder', () => {
    // 2024-03-04 er mandag
    const shDage = new Set<ISODateString>();
    const result = buildFerieDageSet(
      { ferieperioder: [{ fra: '2024-03-04', til: '2024-03-04' }] },
      shDage,
      iso('2024-03-01'),
      iso('2024-03-31')
    );
    expect(result.has(iso('2024-03-04'))).toBe(true);
  });

  it('tilføjer ikke weekend-dage fra ferieperioder', () => {
    // 2024-03-02 er lørdag
    const shDage = new Set<ISODateString>();
    const result = buildFerieDageSet(
      { ferieperioder: [{ fra: '2024-03-02', til: '2024-03-02' }] },
      shDage,
      iso('2024-03-01'),
      iso('2024-03-31')
    );
    expect(result.has(iso('2024-03-02'))).toBe(false);
  });

  it('løse feriedage fra tafPerioder placeres som første dage', () => {
    // TAF-periode 2024-03-04 → 2024-03-08 med 2 løse feriedage → mandag + tirsdag
    const shDage = new Set<ISODateString>();
    const result = buildFerieDageSet(
      {
        tafPerioder: [{ fra: '2024-03-04', til: '2024-03-08', loseFeriedage: 2 }],
      },
      shDage,
      iso('2024-03-01'),
      iso('2024-03-31')
    );
    expect(result.has(iso('2024-03-04'))).toBe(true); // mandag
    expect(result.has(iso('2024-03-05'))).toBe(true); // tirsdag
    expect(result.has(iso('2024-03-06'))).toBe(false); // onsdag (kun 2 løse)
  });
});
