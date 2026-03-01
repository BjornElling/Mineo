import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetEalCalculation, formatPercentTrimmedFromRounded4 } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { aarsloenMax, erhvervsevnetabMax, reguleringssats } from '../../../data/regulationRates';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('computeEetEalCalculation', () => {
  it('beregner EAL-krav med regulering, maksimum og aldersreduktion', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(489000),
        ealAarsloen: undefined,
        ealEetPct: 75,
        aslAfgoerelser: [],
      },
      skadesdato: '2019-06-01',
      fodselsdato: '1966-01-08',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation).not.toBeNull();
    expect(result.computation?.reguleringsPctRounded4).toBe(22.8178);
    expect(result.computation?.reguleretAarsloen).toBe(600500);
    expect(result.computation?.eetBeregnet).toBe(4503750);
    expect(result.computation?.eetAnvendt).toBe(4503750);
    expect(result.computation?.aldersreduktionPct).toBe(24);
    expect(result.computation?.aldersreduktionBeloeb).toBe(1080900);
    expect(result.computation?.ealKrav).toBe(3422850);
  });

  it('vælger EET % fra seneste afgørelse med tie-break på virkningsdato og endelig prioritet', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-06-01',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
          {
            id: 'b',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-06-01',
            eetPct: '45',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2020-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.eetPct).toBe(45);
    expect(result.computation?.eetPctSource).toBe('asl');
  });

  it('giver særskilt fejl ved to identiske endelige afgørelser', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-06-01',
            eetPct: '40',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'b',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-06-01',
            eetPct: '45',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2020-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes('identiske afgørelser'))).toBe(true);
  });

  it('giver fejl når EET % ikke kan bestemmes fra EAL eller ASL', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-06-01',
            eetPct: undefined,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2020-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message === 'Erhvervsevnetabsprocent er ikke udfyldt')).toBe(true);
  });

  it('giver fejl når reguleringssats mangler for et nødvendigt år', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: 40,
        aslAfgoerelser: [],
      },
      skadesdato: '2024-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats: { ...reguleringssats, 2025: undefined as unknown as number },
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message.includes('Reguleringssats mangler'))).toBe(true);
  });

  it('springer regulering og 500-afrunding over når skadesår og beregningsår er ens', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500123),
        ealAarsloen: asAmount(500123),
        ealEetPct: 40,
        aslAfgoerelser: [],
      },
      skadesdato: '2026-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues).toEqual([]);
    expect(result.computation).not.toBeNull();
    expect(result.computation?.reguleringsaar).toEqual([]);
    expect(result.computation?.reguleringsPctRounded4).toBe(0);
    expect(result.computation?.aarsloen).toBe(500123);
    expect(result.computation?.reguleretAarsloen).toBe(500123);
  });

  it('viser advarsel når EAL EET % er under 15', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: 10,
        aslAfgoerelser: [],
      },
      skadesdato: '2020-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('EET efter EAL på mindre end 15 %'))).toBe(true);
  });

  it('viser advarsel når ASL-fallback EET % er under 15', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: undefined,
        ealEetPct: undefined,
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-01-01',
            virkningsDato: '2025-01-01',
            eetPct: '10',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2020-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('Der er angivet et EET på mindre end 15 %'))).toBe(true);
  });

  it('viser advarsel når EAL-årsløn svarer til maks årsløn for skadesåret', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(500000),
        ealAarsloen: asAmount(539000),
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadesdato: '2019-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('fulde årsløn skal indtastes'))).toBe(true);
  });

  it('viser advarsel når EAL-årsløn er tom og ASL-årsløn svarer til maks årsløn for skadesåret', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(539000),
        ealAarsloen: undefined,
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadesdato: '2019-01-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(result.issues.some((issue) => issue.severity === 'warning' && issue.message.includes('fulde årsløn skal indtastes'))).toBe(true);
  });

  it('viser advarsel når skadesdato er fra 1. juli 2024 og EAL-årsløn ikke er udfyldt', () => {
    const result = computeEetEalCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-02-27',
        aslAarsloen: asAmount(600000),
        ealAarsloen: undefined,
        ealEetPct: 20,
        aslAfgoerelser: [],
      },
      skadesdato: '2024-07-01',
      fodselsdato: '1990-01-01',
      reguleringssats,
      erhvervsevnetabMax,
      aarsloenMax,
    });

    expect(
      result.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          issue.message === 'For skader fra 1. juli 2024 og frem beregnes årsløn forskelligt efter EAL og ASL'
      )
    ).toBe(true);
  });
});

describe('formatPercentTrimmedFromRounded4', () => {
  it('trimmer efterfølgende nuller efter afrunding til 4 decimaler', () => {
    expect(formatPercentTrimmedFromRounded4(22.8178)).toBe('22,8178');
    expect(formatPercentTrimmedFromRounded4(22.8100)).toBe('22,81');
    expect(formatPercentTrimmedFromRounded4(22.8)).toBe('22,8');
    expect(formatPercentTrimmedFromRounded4(23)).toBe('23');
  });
});
