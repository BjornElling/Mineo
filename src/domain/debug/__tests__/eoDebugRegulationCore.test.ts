/**
 * Tests for Regulation Core Model (Index)
 */

import { buildRegulationTimeline } from '../eoDebugRegulationCore';
import type { DebugDay } from '../eoDebugTypes';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../types/common';
import { LOEN_PAA_HELLIGDAGE } from '../../../types/common';
import { createErstatningsopgoerelseInitialValues } from '../../erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
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
