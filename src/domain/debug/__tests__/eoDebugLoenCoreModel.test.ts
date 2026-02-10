/**
 * Tests for Loen Core Model - Phase 5.2 (rettet)
 */

import { buildLoenTimeline } from '../eoDebugLoenCoreModel';
import type { DebugDay } from '../eoDebugTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../types/common';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/common';
import { createErstatningsopgoerelseInitialValues } from '../../erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { svieSmertePrDag } from '../../../data/regulationRates';

const makeDebugDay = (
  iso: string,
  isArbejdsdag: boolean,
  svieSmerte: DebugDay['svieSmerte'] = 'Ingen'
): DebugDay => ({
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
  ...overrides,
} as ErstatningsopgoerelseValues);

const makeInput = (
  debugDays: DebugDay[],
  overrides: Partial<ErstatningsopgoerelseValues> = {}
) => ({
  debugDays,
  eoValues: makeEOValues(overrides),
  stamdataValues: {} as StamdataValues,
});

describe('buildLoenTimeline - Phase 5.2 (rettet)', () => {
  it('bygger grundloenspakke for arbejdsdage inden for EO-periode', () => {
    const debugDays = [
      makeDebugDay('2024-01-02', true),
      makeDebugDay('2024-01-06', false),
    ];

    const result = buildLoenTimeline(makeInput(debugDays));
    expect(result.loenDays.length).toBe(1);
    expect(result.loenDays[0]?.iso).toBe('2024-01-02');
  });

  it('udelader grundloenspakke uden EO-periode', () => {
    const debugDays = [makeDebugDay('2024-01-02', true)];
    const result = buildLoenTimeline(
      makeInput(debugDays, { vedroererPeriodeFra: '', vedroererPeriodeTil: '' })
    );
    expect(result.loenDays.length).toBe(0);
  });

  it('anvender store bededag tillæg fra 2024-01-01 ved almindelig løn på helligdage', () => {
    const debugDays = [
      makeDebugDay('2023-12-15', true),
      makeDebugDay('2024-01-15', true),
    ];

    const result = buildLoenTimeline(makeInput(debugDays));
    const before = result.loenDays.find((d) => d.iso === '2023-12-15');
    const after = result.loenDays.find((d) => d.iso === '2024-01-15');

    const beforeTypes = before?.components.map((c) => c.type) ?? [];
    const afterTypes = after?.components.map((c) => c.type) ?? [];
    expect(beforeTypes.includes('storeBededag')).toBe(false);
    expect(afterTypes.includes('storeBededag')).toBe(true);
  });

  it('bygger svie/smerte pr. kalenderdag med fast sats for valgt aar', () => {
    const debugDays = [
      makeDebugDay('2024-01-06', false, 'Fuld'),
      makeDebugDay('2024-01-07', false, 'Delvis'),
    ];

    const result = buildLoenTimeline(makeInput(debugDays));
    expect(result.svieSmerteDays.length).toBe(2);

    const fuld = result.svieSmerteDays[0];
    const delvis = result.svieSmerteDays[1];
    expect(fuld?.amount).toBeGreaterThan(0);
    expect(delvis?.amount).toBe(fuld?.amount ? fuld.amount / 2 : 0);
  });

  it('udelader store bededag naar loen paa helligdage ikke er almindelig', () => {
    const debugDays = [makeDebugDay('2024-02-15', true)];
    const result = buildLoenTimeline(
      makeInput(debugDays, {
        loenindkomstAnsaettelsesforhold: [
          {
            ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
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
    const debugDays = [makeDebugDay('2025-01-06', false, 'Fuld')];
    const result = buildLoenTimeline(
      makeInput(debugDays, { svieSmerteSatserAar: 2024 })
    );
    expect(result.svieSmerteDays[0]?.amount).toBe(svieSmertePrDag[2024]);
  });
});



