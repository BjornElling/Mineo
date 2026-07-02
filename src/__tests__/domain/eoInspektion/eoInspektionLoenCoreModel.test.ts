/**
 * Tests for Loen Core Model - Phase 5.2 (rettet)
 */

import { buildLoenTimeline } from '../../../domain/eoInspektion/eoInspektionLoenCoreModel';
import type { RowDay } from '../../../domain/eoRowEvaluation/eoRowTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/loen';
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { svieSmertePrDag } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

const makeRowDay = (
  iso: string,
  isArbejdsdag: boolean,
  svieSmerte: RowDay['svieSmerte'] = 'Ingen'
): RowDay => ({
  iso: iso as any,
  weekday: 1,
  isWeekend: false,
  isSognehelligdag: false,
  isArbejdsdag,
  tafFlags: new Set(),
  svieSmerte,
});

const makeEOValues = (
  overrides: Partial<ErstatningsopgoerelseValues> = {}
): ErstatningsopgoerelseValues => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: toISODateString('2024-01-01'),
  vedroererPeriodeTil: toISODateString('2024-12-31'),
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
      fuldLoenUnderFerie: 'Nej', // Bevidst testvalg — system-default er 'Ja'
      loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
      saerligFraDatoRegulering: undefined,
      loenudviklingBeregningsgrundlag: 'Ingen',
      loenudviklingStatistikModel: undefined,
      loenudviklingManuelTableData: [],
    },
  ],
  ...overrides,
} as ErstatningsopgoerelseValues);

const makeInput = (
  inspektionDays: RowDay[],
  overrides: Partial<ErstatningsopgoerelseValues> = {}
) => ({
  inspektionDays,
  eoValues: makeEOValues(overrides),
  stamdataValues: {} as StamdataValues,
});

describe('buildLoenTimeline - Phase 5.2 (rettet)', () => {
  it('bygger grundloenspakke for arbejdsdage inden for EO-periode', () => {
    const inspektionDays = [
      makeRowDay(toISODateString('2024-01-02'), true),
      makeRowDay(toISODateString('2024-01-06'), false),
    ];

    const result = buildLoenTimeline(makeInput(inspektionDays));
    expect(result.loenDays.length).toBe(1);
    expect(result.loenDays[0]?.iso).toBe(toISODateString('2024-01-02'));
  });

  it('udelader grundloenspakke uden EO-periode', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-01-02'), true)];
    const result = buildLoenTimeline(
      makeInput(inspektionDays, { vedroererPeriodeFra: undefined, vedroererPeriodeTil: undefined })
    );
    expect(result.loenDays.length).toBe(0);
  });

  it('anvender store bededag tillæg fra 2024-01-01 ved almindelig løn på helligdage', () => {
    const inspektionDays = [
      makeRowDay(toISODateString('2023-12-15'), true),
      makeRowDay(toISODateString('2024-01-15'), true),
    ];

    const result = buildLoenTimeline(makeInput(inspektionDays));
    const before = result.loenDays.find((d) => d.iso === toISODateString('2023-12-15'));
    const after = result.loenDays.find((d) => d.iso === toISODateString('2024-01-15'));

    const beforeTypes = before?.components.map((c) => c.type) ?? [];
    const afterTypes = after?.components.map((c) => c.type) ?? [];
    expect(beforeTypes.includes('storeBededag')).toBe(false);
    expect(afterTypes.includes('storeBededag')).toBe(true);
  });

  it('bygger svie/smerte pr. kalenderdag med fast sats for valgt aar', () => {
    const inspektionDays = [
      makeRowDay(toISODateString('2024-01-06'), false, 'Fuld'),
      makeRowDay(toISODateString('2024-01-07'), false, 'Delvis'),
    ];

    const result = buildLoenTimeline(makeInput(inspektionDays));
    expect(result.svieSmerteDays.length).toBe(2);

    const fuld = result.svieSmerteDays[0];
    const delvis = result.svieSmerteDays[1];
    expect(fuld?.amount).toBeGreaterThan(0);
    expect(delvis?.amount).toBe(fuld?.amount ? fuld.amount / 2 : 0);
  });

  it('udelader store bededag naar loen paa helligdage ikke er almindelig', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-02-15'), true)];
    const result = buildLoenTimeline(
      makeInput(inspektionDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af-1',
            harOverenskomst: true,
            overenskomstId: 'bygge-anlaeg',
            feriePct: 12.5,
            loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.SH_UDBETALING,
          },
        ],
      })
    );

    const day = result.loenDays[0];
    const types = day?.components.map((c) => c.type) ?? [];
    expect(types.includes('storeBededag')).toBe(false);
  });

  it('bruger svie/smerte sats fra valgt aar, ikke datoens aar', () => {
    const inspektionDays = [makeRowDay(toISODateString('2025-01-06'), false, 'Fuld')];
    const result = buildLoenTimeline(
      makeInput(inspektionDays, { svieSmerteSatserAar: 2024 })
    );
    expect(result.svieSmerteDays[0]?.amount).toBe(svieSmertePrDag[2024]);
  });

  it('returnerer tom timeline ved ukendt overenskomstId', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(
      makeInput(inspektionDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af-1',
            harOverenskomst: true,
            overenskomstId: 'ukendt-overenskomst-der-ikke-eksisterer',
            feriePct: 12.5,
            loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
          },
        ],
      })
    );
    expect(result.loenDays).toHaveLength(0);
  });

  it('returnerer tom timeline når overenskomstId mangler', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(
      makeInput(inspektionDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af-1',
            harOverenskomst: false,
            overenskomstId: undefined,
            feriePct: 12.5,
            loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
          },
        ],
      })
    );
    expect(result.loenDays).toHaveLength(0);
  });
});

// ─── Offentlig løn-path (KL-overenskomst) ────────────────────────────────────

describe('buildLoenTimeline — offentlig løn-path (KL)', () => {
  const makeKLInput = (
    inspektionDays: RowDay[],
    overrides: Partial<ErstatningsopgoerelseValues> = {}
  ) => ({
    inspektionDays,
    eoValues: {
      ...createErstatningsopgoerelseInitialValues(),
      vedroererPeriodeFra: toISODateString('2024-01-01'),
      vedroererPeriodeTil: toISODateString('2024-12-31'),
      svieSmerteSatserAar: 2024,
      svieSmerteDelvisSygemeldingSats: 'halv',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createDefaultLoenindkomstAnsaettelsesforhold(),
          id: 'af-kl',
          harOverenskomst: true,
          overenskomstId: 'kl-overenskomst',
          feriePct: 12.5,
          loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
          offentligLoenType: 'Timeløn',
          offentligLoenTrin: 20,
          offentligLoenGruppe: 0,
        },
      ],
      ...overrides,
    } as ErstatningsopgoerelseValues,
    stamdataValues: {} as StamdataValues,
  });

  it('bygger loendag via offentlig løn-opslag (KL, løntrin 20, gruppe 0)', () => {
    // 2024-03-04 er mandag — en normal arbejdsdag
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    expect(result.loenDays).toHaveLength(1);
    expect(result.loenDays[0]?.iso).toBe(toISODateString('2024-03-04'));
    const types = result.loenDays[0]?.components.map((c) => c.type) ?? [];
    expect(types).toContain('grundloen');
  });

  it('daglig total er et positivt beløb ved KL-opslag', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    expect(result.loenDays[0]?.dailyTotal).toBeGreaterThan(0);
  });

  it('inkluderer store bededag-komponent for KL-dag efter 2024-01-01', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    const types = result.loenDays[0]?.components.map((c) => c.type) ?? [];
    expect(types).toContain('storeBededag');
  });

  it('ekskluderer KL-dag udenfor EO-perioden', () => {
    const inspektionDays = [makeRowDay(toISODateString('2023-06-01'), true)]; // udenfor 2024-perioden
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    expect(result.loenDays).toHaveLength(0);
  });

  it('ignorerer ikke-arbejdsdage i KL-path', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-02'), false)]; // lørdag
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    expect(result.loenDays).toHaveLength(0);
  });

  it('svie/smerte akkumuleres uanset offentlig løn-path', () => {
    // Kalenderdag uden for EO-periode med svie/smerte → svieSmerteDays udfyldes
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), false, 'Fuld')];
    const result = buildLoenTimeline(makeKLInput(inspektionDays));
    expect(result.svieSmerteDays).toHaveLength(1);
    expect(result.svieSmerteDays[0]?.niveau).toBe('Fuld');
  });

  it('KL månedsløntype: grundloen-komponent eksisterer', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(
      makeKLInput(inspektionDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af-kl',
            harOverenskomst: true,
            overenskomstId: 'laerer-overenskomsten',
            feriePct: 12.5,
            loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
            offentligLoenType: 'Månedsløn',
            offentligLoenTrin: 20,
            offentligLoenGruppe: 0,
          },
        ],
      })
    );
    expect(result.loenDays).toHaveLength(1);
    const types = result.loenDays[0]?.components.map((c) => c.type) ?? [];
    expect(types).toContain('grundloen');
  });

  it('KL fallback: bruger input-pension når overenskomst-tillæg mangler', () => {
    const inspektionDays = [makeRowDay(toISODateString('2024-03-04'), true)];
    const result = buildLoenTimeline(
      makeKLInput(inspektionDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createDefaultLoenindkomstAnsaettelsesforhold(),
            id: 'af-kl',
            harOverenskomst: true,
            overenskomstId: 'kl-overenskomst',
            feriePct: 12.5,
            pensionPct: 15.3,
            loenPaaHelligdage: LOEN_PAA_HELLIGDAGE.ALMINDELIG,
            offentligLoenType: 'Timeløn',
            offentligLoenTrin: 20,
            offentligLoenGruppe: 0,
          },
        ],
      })
    );

    expect(result.loenDays).toHaveLength(1);
    const types = result.loenDays[0]?.components.map((c) => c.type) ?? [];
    expect(types).toContain('pension');
  });
});
