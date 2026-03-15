import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetKapitaliseringCalculation } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('computeEetKapitaliseringCalculation', () => {
  it('giver en generel fejl når der ikke er indtastet nogen afgørelse', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'asl-afgoerelser-empty',
      severity: 'error',
      message: 'Ingen ASL-afgørelser er indtastet.',
    });
    expect(result.issues.some((issue) => issue.id === 'missing-afgoerelsesdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-afgoerelsestype')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-eet-pct')).toBe(false);
  });

  it('giver samme generelle fejl for tom placeholder-række uden indtastning', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: undefined,
            virkningsDato: undefined,
            eetPct: undefined,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: undefined,
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'asl-afgoerelser-empty',
      severity: 'error',
      message: 'Ingen ASL-afgørelser er indtastet.',
    });
    expect(result.issues.some((issue) => issue.id === 'missing-afgoerelsesdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-afgoerelsestype')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-eet-pct')).toBe(false);
  });

  it('giver ikke felt-specifikke fejl når kapitaliseringsdato og -procent begge er tomme', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues.some((issue) => issue.id === 'missing-kap-dato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-kap-pct')).toBe(false);
  });

  it('giver kap-dato-without-kap-pct fejl når kapitaliseringsdato er udfyldt men ikke -procent', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2025-07-01',
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues).toContainEqual({
      id: 'kap-dato-without-kap-pct',
      severity: 'error',
      message: 'Der er indtastet kapitaliseringsdato men ikke -procent.',
    });
    expect(result.issues.some((issue) => issue.id === 'missing-kap-dato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-kap-pct')).toBe(false);
  });

  it('giver kap-pct-without-kap-dato fejl når kapitaliseringsprocent er udfyldt men ikke -dato', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: undefined,
            kapPct: '50',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues).toContainEqual({
      id: 'kap-pct-without-kap-dato',
      severity: 'error',
      message: 'Der er indtastet kapitaliseringsprocent men ikke -dato.',
    });
    expect(result.issues.some((issue) => issue.id === 'missing-kap-dato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-kap-pct')).toBe(false);
  });

  it('giver fejl om manglende endelig eller delvist endelig afgørelse når kun midlertidige afgørelser er indtastet', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Midlertidig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'no-endelig-afgoerelser',
      severity: 'error',
      message: 'Ingen endelig eller delvist endelig afgørelser indtastet.',
    });
    expect(result.issues.some((issue) => issue.id === 'missing-kap-dato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'missing-kap-pct')).toBe(false);
  });

  it('giver specifik fejl for afgørelsesdato når kun den mangler', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: undefined,
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.message === 'Der er en afgørelse uden afgørelsesdato.')).toBe(true);
    expect(result.issues.some((issue) => issue.message === 'Der er en afgørelse uden EET %.')).toBe(false);
  });

  it('beregner kapitalisering med tabelinterpolation for en moderne bekendtgørelse', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2025-10-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.grundydelse).toBe(116067.2);
    expect(result.computation?.afgoerelser[0]?.reguleringsPctRounded4).toBe(3.9);
    expect(result.computation?.afgoerelser[0]?.kapitaliseringsfaktor).toBe(4.597);
    expect(result.computation?.afgoerelser[0]?.kapitalbelob).toBe(554370);
    expect(result.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
  });

  it('opregulerer præ-2024-skade til 2024-niveau uden ekstra 2024-sats i kapitaliseringsleddet', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(489000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2024-01-15',
            virkningsDato: '2024-01-15',
            eetPct: '25',
            kapDato: '2024-02-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues).toEqual([]);
    const afgoerelse = result.computation?.afgoerelser[0];
    expect(afgoerelse?.reguleringsPctRounded4).toBe(0);
    expect(afgoerelse?.grundydelse).toBe(63561.11);
    expect(afgoerelse?.aarsydelse).toBe(105320.76);
  });

  it('bruger særfaktor direkte når kontroltidspunktet er under to år til folkepension', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2025-10-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1959-01-01',
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.afgoerelser[0]?.kapitaliseringsfaktor).toBe(1.245);
    expect(result.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
    expect(result.computation?.afgoerelser[0]?.kapitalbelob).toBe(150140);
  });

  it('låser faktorgrundlaget til afgørelsestidspunktet når kapitaliseret pga. under to år til folkepension er ja', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2026-12-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1959-01-01',
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
    expect(result.computation?.afgoerelser[0]?.kapitaliseringsfaktor).toBe(1.245);
    expect(result.computation?.afgoerelser[0]?.folkepensionsalderLabel).toBe('67 år');
  });

  it('giver blokerende fejl når kapitaliseringsprocent er udfyldt uden kapitaliseringsdato', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: undefined,
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues.some((issue) => issue.id === 'kap-pct-without-kap-dato')).toBe(true);
  });

  it('giver specifik fejl når koen mangler for en koensopdelt kapitaliseringstabel', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        koen: undefined,
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2008-01-15',
            virkningsDato: '2008-01-15',
            eetPct: '50',
            kapDato: '2008-02-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2007-07-01',
      fodselsdato: '1960-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'missing-koen',
      severity: 'error',
      message: 'Ved kapitalisering før 1. marts 2015 skal køn angives.',
    });
  });

  it('beregner historisk koensopdelt tabel når koen er udfyldt', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        koen: 'Mand',
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2008-01-15',
            virkningsDato: '2008-01-15',
            eetPct: '50',
            kapDato: '2008-02-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2007-07-01',
      fodselsdato: '1960-01-01',
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.tabelLabel).toBe('A');
    expect(result.computation?.afgoerelser[0]?.kapitaliseringsfaktor).toBeGreaterThan(0);
  });

  it('giver specifik fejl når den valgte tabel mangler kapitaliseringsfaktorer', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        koen: 'Mand',
        aslAarsloen: asAmount(400000),
        aslAfgoerelser: [
          {
            id: 'a',
            afgoerelsesDato: '2004-01-15',
            virkningsDato: '2004-01-15',
            eetPct: '50',
            kapDato: '2004-02-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2005-01-01',
      fodselsdato: '1944-01-01',
    });

    expect(result.computation).toBeNull();
    expect(result.issues).toContainEqual({
      id: 'kapitaliseringstabel-missing',
      severity: 'error',
      message: 'Ingen kapitaliseringsfaktorer indtastet for tabel A.',
    });
  });

  it('sorterer flere afgørelser deterministisk efter afgørelsesdato, kapitaliseringsdato og row id', () => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [
          {
            id: 'c',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2025-10-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a',
            afgoerelsesDato: '2025-06-01',
            virkningsDato: '2025-06-01',
            eetPct: '50',
            kapDato: '2025-08-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'b',
            afgoerelsesDato: '2025-07-01',
            virkningsDato: '2025-07-01',
            eetPct: '50',
            kapDato: '2025-09-01',
            kapPct: '25',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2025-01-01',
      fodselsdato: '1965-01-01',
    });

    expect(result.issues).toEqual([]);
    expect(result.computation?.afgoerelser.map((row) => row.rowId)).toEqual(['a', 'b', 'c']);
  });
});
