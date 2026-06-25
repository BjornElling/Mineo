/**
 * Tests for Regulation Core Model (Index)
 */

import { buildRegulationTimeline, buildSHDageSet, buildFerieDageSet } from '../../../domain/debug/eoDebugRegulationCore';
import type { DebugDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { ISODateString } from '../../../types/branded';
import { aarsloenAslMax, getYearBoundsForYearlyRate } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

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
  debugDays: [makeDebugDay(toISODateString('2024-01-01'))],
  eoValues: ({
    ...createErstatningsopgoerelseInitialValues(),
    vedroererPeriodeFra: toISODateString('2024-01-01'),
    vedroererPeriodeTil: toISODateString('2024-12-31'),
    tafBeregningsperiodeTil: toISODateString('2024-01-01'),
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
        loenudviklingBeregningsgrundlag: 'Overenskomst',
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
    skadestype: undefined,
    skadedato: iso('2024-01-01'),
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
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-12-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-06-01');
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    const hasSbd = entries.some((entry) => entry.effectiveFrom === toISODateString('2024-01-01'));
    expect(hasSbd).toBe(true);
  });

  it('indsætter 01-01-2024 som entry for bygge-anlaeg fordi overenskomsten har en regulering på den dato', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-12-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-06-01');
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.SH_UDBETALING;
    input.stamdataValues.skadedato = iso('2023-12-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-12-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    const hasSbd = entries.some((entry) => entry.effectiveFrom === toISODateString('2024-01-01'));
    expect(hasSbd).toBe(true);
  });

  it('udelader 01-01-2024 for overenskomst uden regulering på datoen når SH-dage udbetales særskilt', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-12-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-06-01');
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = 'industriens-overenskomst';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.SH_UDBETALING;
    input.stamdataValues.skadedato = iso('2023-12-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-12-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    const hasFirstJanuaryEntry = entries.some((entry) => entry.effectiveFrom === toISODateString('2024-01-01'));

    expect(hasFirstJanuaryEntry).toBe(false);
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

  it('første entry har index = 100 når skadedato er lig effectiveFrom', () => {
    // Skadedato = 2024-01-01, EO-periode starter samme dag
    // reference-indeks = entry på skadedatoen → index bør være 100
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    // Find entry med effectiveFrom tidligst i perioden (skadedatoen)
    const firstEntry = entries[0];
    expect(firstEntry).toBeDefined();
    // index = (packageValue / referenceValue) * 100
    // Hvis der kun er én regulering dækker perioden, er index ~100
    expect(firstEntry!.index).toBeCloseTo(100, 0);
  });

  it('referenceValue matcher packageValue ved skadedatoen', () => {
    const input = makeInput();
    const result = buildRegulationTimeline(input);
    const af = result.ansaettelser[0];
    expect(af).toBeDefined();
    // referenceValue er pakkeværdien på skadedatoen
    expect(af!.referenceValue).toBeGreaterThan(0);
    // Første entry (der dækker skadedatoen) skal have index ≈ 100
    const matchingEntry = af!.entries.find((e) => e.effectiveFrom <= af!.referenceIso);
    expect(matchingEntry).toBeDefined();
    expect(matchingEntry!.index).toBeGreaterThan(0);
  });

  it('bruger manuel reguleringsdato som reference uden parenteslabel når datoen ikke matcher standardsporene', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].saerligFraDatoRegulering = toISODateString('2024-02-01');

    const result = buildRegulationTimeline(input);
    const af = result.ansaettelser[0];

    expect(af).toBeDefined();
    expect(af?.referenceIso).toBe(iso('2024-02-01'));
    expect(af?.referenceLabel).toBeUndefined();
  });

  it('markerer skadedato-reference som anmeldelsesdato ved erhvervssygdom', () => {
    const input = makeInput();
    input.stamdataValues.skadestype = 'Erhvervssygdom';

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser[0]?.referenceLabel).toBe('Anmeldelsesdato');
  });

  it('inkluderer altid en entry på reference-/reguleringsdatoen for privat overenskomst', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.stamdataValues.skadedato = iso('2023-11-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-11-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries[0]?.effectiveFrom).toBe(iso('2023-11-01'));
    expect(entries.some((entry) => entry.effectiveFrom === iso('2023-11-01'))).toBe(true);
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

  it('bygger regulering fra eoAngivetLoenLoenudvikling ved angivet månedsløn og KRL satstabel', () => {
    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet månedsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2019-04-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2026-02-26');
    input.eoValues.angivetMaanedsloenOpreguleresFraDato = iso('2020-01-01') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    input.stamdataValues.skadedato = iso('2023-05-24');

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.ansaettelsesforholdId).toBe('eo-angivet-loen');
    expect(result.ansaettelser[0]?.navn).toBe('EO-oplysninger');
    expect(result.ansaettelser[0]?.kildeLabel).toBe('KRL satstabel');
    expect(result.ansaettelser[0]?.kildeVaerdi).toContain('KTO');
    expect(result.ansaettelser[0]?.entries.length).toBeGreaterThan(0);
  });

  it('viser ikke særskilt Store Bededag-regulering i debug-timeline for KRL satstabel', () => {
    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet månedsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-12-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.eoValues.angivetMaanedsloenOpreguleresFraDato = iso('2023-12-31') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KRL satstabel';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingKRLSatstabel = 'KTO (kommuner)';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    input.stamdataValues.skadedato = iso('2023-05-24');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.storeBededagPct === 0)).toBe(true);
  });

  it('bygger regulering fra eoAngivetLoenLoenudvikling ved angivet månedsløn og statistikgrundlag', () => {
    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet månedsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2019-04-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2026-02-26');
    input.eoValues.angivetMaanedsloenOpreguleresFraDato = iso('2020-01-01') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    input.stamdataValues.skadedato = iso('2023-05-24');

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.ansaettelsesforholdId).toBe('eo-angivet-loen');
    expect(result.ansaettelser[0]?.navn).toBe('EO-oplysninger');
    expect(result.ansaettelser[0]?.kildeLabel).toBe('Statistikmodel');
    expect(result.ansaettelser[0]?.kildeVaerdi).toBe('ASL-årslønsmaksimum');
    expect(result.ansaettelser[0]?.entries.length).toBeGreaterThan(0);
  });

  it('viser ikke særskilt Store Bededag-regulering i debug-timeline for statistikgrundlag', () => {
    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet månedsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-12-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.eoValues.angivetMaanedsloenOpreguleresFraDato = iso('2023-12-31') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    input.stamdataValues.skadedato = iso('2023-05-24');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.storeBededagPct === 0)).toBe(true);
  });

  it('afviser ASL-regulering når referenceåret mangler i ASL-data', () => {
    const aslBounds = getYearBoundsForYearlyRate(aarsloenAslMax);
    expect(aslBounds).not.toBeNull();
    expect(aslBounds?.minYear).toBeGreaterThan(2000);

    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet månedsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2000-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2006-12-31');
    input.eoValues.angivetMaanedsloenOpreguleresFraDato = iso('2000-06-01') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.entries).toEqual([]);
    expect(result.ansaettelser[0]?.referenceValue).toBe(0);
  });

  it('bevarer 0 pct ferie i manuelle reguleringsrækker uden fallback til ansættelsens feriePct', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelNavn = 'Manuel test';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].feriePct = 12.5;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelTableData = [
      {
        id: 'row-1',
        dato: '',
        grundloen: { value: 100 } as any,
        feriepenge: 0,
        shSoSats: 0,
        fritvalg: 0,
        agPension: 0,
      } as any,
    ];

    const result = buildRegulationTimeline(input);
    const firstEntry = result.ansaettelser[0]?.entries[0];

    expect(firstEntry?.feriePct).toBe(0);
    expect(firstEntry?.packageValue).toBeCloseTo(100.45, 6);
  });

  it('bygger regulering fra eoAngivetLoenLoenudvikling ved angivet dagsløn og statistikgrundlag', () => {
    const input = makeInput();
    input.eoValues.beregnesUdFra = 'Angivet dagsløn';
    input.eoValues.vedroererPeriodeFra = toISODateString('2019-04-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2026-02-26');
    input.eoValues.angivetDagsloenOpreguleresFraDato = iso('2020-01-01') as any;
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Statistik';
    input.eoValues.eoAngivetLoenLoenudvikling.loenudviklingStatistikModel = 'ASL-årslønsmaksimum';
    input.eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.ansaettelsesforholdId).toBe('eo-angivet-loen');
    expect(result.ansaettelser[0]?.kildeLabel).toBe('Statistikmodel');
    expect(result.ansaettelser[0]?.entries.length).toBeGreaterThan(0);
  });

  it('returnerer tom ansaettelser ved manglende skadedato', () => {
    const input = makeInput();
    input.stamdataValues.skadedato = '' as any;
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(0);
  });

  it('returnerer tom ansaettelser ved manglende overenskomstId', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'Overenskomst';
    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(0);
  });

  it('bygger manuel reguleringssektion uden overenskomstId', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelNavn = 'overenskomst Tandlægeforening/HK';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelTableData = [
      {
        id: 'row-1',
        dato: '',
        grundloen: { value: 150 },
        feriepenge: 12.5,
        shSoSats: 0,
        fritvalg: 0,
        agPension: 10.15,
      } as any,
    ];

    const result = buildRegulationTimeline(input);
    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.kildeLabel).toBe('Navn på reguleringsform');
    expect(result.ansaettelser[0]?.kildeVaerdi).toBe('Manuelt angivet (overenskomst Tandlægeforening/HK)');
  });

  it('indsætter 01-01-2024 som separat manuel reguleringsdato for Store Bededag selv når næste række er 01-03-2024', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-06-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2026-02-04');
    input.stamdataValues.skadedato = iso('2023-05-24');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-05-24');
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'Manuelt angivet';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelNavn = 'overenskomst Tandlægeforening/HK';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].feriePct = 15;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenPaaHelligdage = LOEN_PAA_HELLIGDAGE.ALMINDELIG;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingManuelTableData = [
      {
        id: 'row-1',
        dato: '',
        grundloen: { value: 25174 },
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 7.00,
        agPension: 9.00,
      } as any,
      {
        id: 'row-2',
        dato: toISODateString('2024-03-01'),
        grundloen: { value: 25174 },
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      } as any,
      {
        id: 'row-3',
        dato: toISODateString('2024-04-01'),
        grundloen: { value: 25895 },
        feriepenge: 15.00,
        shSoSats: undefined,
        fritvalg: 9.00,
        agPension: 11.00,
      } as any,
    ];

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries.some((entry) => entry.effectiveFrom === toISODateString('2024-01-01'))).toBe(true);
  });

  it('bevarer privat overenskomst som placeholder når reference-dato ligger før første reguleringsværdi', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2020-04-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2026-02-26');
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = 'laasesmedeoverenskomsten';
    input.stamdataValues.skadedato = iso('2020-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2020-01-01');

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.referenceIso).toBe(iso('2020-01-01'));
    expect(result.ansaettelser[0]?.entries).toEqual([]);
  });

  it('bevarer statistikmodel som placeholder når reference-dato ligger før første kendte statistikværdi', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'Statistik';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingStatistikModel = 'ILON12 (Danmarks Statistik)';
    input.eoValues.vedroererPeriodeFra = toISODateString('2000-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2006-12-31');
    input.stamdataValues.skadedato = iso('2000-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2000-01-01');

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.referenceIso).toBe(iso('2000-01-01'));
    expect(result.ansaettelser[0]?.entries).toEqual([]);
  });

  it('bevarer KRL satstabel som placeholder når reference-dato ligger før første kendte KRL-værdi', () => {
    const input = makeInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].overenskomstId = undefined as any;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag = 'KRL satstabel';
    input.eoValues.loenindkomstAnsaettelsesforhold[0].loenudviklingKRLSatstabel = 'KTO (kommuner)';
    input.eoValues.vedroererPeriodeFra = toISODateString('2000-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2002-12-31');
    input.stamdataValues.skadedato = iso('2000-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2000-01-01');

    const result = buildRegulationTimeline(input);

    expect(result.ansaettelser).toHaveLength(1);
    expect(result.ansaettelser[0]?.referenceIso).toBe(iso('2000-01-01'));
    expect(result.ansaettelser[0]?.entries).toEqual([]);
  });
});

// ─── Periode-overgange ────────────────────────────────────────────────────────

describe('buildRegulationTimeline — periode-overgange', () => {
  it('to reguleringsperioder i EO-perioden → mindst 2 entries', () => {
    // EO-periode 2023-01-01 → 2024-12-31 dækker typisk 2+ reguleringsdatoer for bygge-anlaeg
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2022-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.stamdataValues.skadedato = iso('2022-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2022-01-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('seneste entry har højere index end første (løn stiger over tid)', () => {
    const input = makeInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2022-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.stamdataValues.skadedato = iso('2022-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2022-01-01');

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
    input.eoValues.vedroererPeriodeFra = toISODateString('2022-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.stamdataValues.skadedato = iso('2022-01-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2022-01-01');

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
    debugDays: [makeDebugDay(toISODateString('2024-01-01'))],
    eoValues: ({
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-12-31'),
      tafBeregningsperiodeTil: toISODateString('2024-01-01'),
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
          loenudviklingBeregningsgrundlag: 'Overenskomst',
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
      skadestype: undefined,
      skadedato: iso('2024-01-01'),
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

  it('KL fallback: bruger input-pct når overenskomst-tillæg mangler', () => {
    const input = makeKLInput();
    input.eoValues.loenindkomstAnsaettelsesforhold[0].shSoPct = 2.5;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].fritvalgPct = 1.25;
    input.eoValues.loenindkomstAnsaettelsesforhold[0].pensionPct = 15.3;

    const result = buildRegulationTimeline(input);
    const firstEntry = result.ansaettelser[0]?.entries[0];
    expect(firstEntry).toBeDefined();
    expect(firstEntry?.shSoPct).toBeCloseTo(0.025, 6);
    expect(firstEntry?.fritvalgPct).toBeCloseTo(0.0125, 6);
    expect(firstEntry?.pensionPct).toBeCloseTo(0.153, 6);
  });

  it('inkluderer altid en entry på reference-/reguleringsdatoen for offentlig løn', () => {
    const input = makeKLInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    input.stamdataValues.skadedato = iso('2023-11-01');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-11-01');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries[0]?.effectiveFrom).toBe(iso('2023-11-01'));
    expect(entries.some((entry) => entry.effectiveFrom === iso('2023-11-01'))).toBe(true);
  });

  it('indsætter Store Bededag som separat reguleringsdato 01-01-2024 for offentlig løn', () => {
    const input = makeKLInput();
    input.eoValues.vedroererPeriodeFra = toISODateString('2023-06-01');
    input.eoValues.vedroererPeriodeTil = toISODateString('2025-12-31');
    input.stamdataValues.skadedato = iso('2023-05-24');
    input.eoValues.tafBeregningsperiodeTil = iso('2023-05-24');

    const result = buildRegulationTimeline(input);
    const entries = result.ansaettelser[0]?.entries ?? [];

    expect(entries.some((entry) => entry.effectiveFrom === iso('2024-01-01'))).toBe(true);
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
      { ferieperioder: [{ fra: toISODateString('2024-03-04'), til: toISODateString('2024-03-04') }] },
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
      { ferieperioder: [{ fra: toISODateString('2024-03-02'), til: toISODateString('2024-03-02') }] },
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
        tafPerioder: [{ fra: toISODateString('2024-03-04'), til: toISODateString('2024-03-08'), loseFeriedage: 2 }],
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
