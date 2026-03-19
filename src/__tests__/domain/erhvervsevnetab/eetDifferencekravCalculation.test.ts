import { describe, expect, it } from 'vitest';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';

// Fælles stamdata for alle ≤ 2 år-tests i denne fil:
//   skadesdato 2019-04-01, fødselsdato 1955-07-01
//   FP = 67 år → folkepensionsdato = 2022-07-01
//   Bekendtgørelse BEK 9921/2019 → særfaktor = 1.245 (67 år, skadesdato 2019)

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });

describe('computeEetDifferencekravCalculation', () => {
  describe('uden ≤ 2 år til folkepension', () => {
    it('fradrager løbende ydelser til dagen før beregningsdatoen og proformakapitaliserer rest-EET', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2026-12-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-01-2024',
            virkningsDato: '01-01-2024',
            eetPct: '60',
            kapDato: '01-01-2025',
            kapPct: '30',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1980-01-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(result.computation?.fradragLoebendeYdelser).toBeGreaterThan(0);
      expect(result.computation?.fradragKapitaliseretEet).toBeGreaterThan(0);
      expect(result.computation?.proformaKapitalisering).not.toBeNull();
      expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
    });
  });

  describe('≤ 2 år til folkepension — scenarie 1 (afgørelsesdato > 2 år før FP)', () => {
    it('fradrager løbende ydelser til folkepensionsdatoen og proformakapitaliserer rest-EET på beregningsdatoen', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-06-2019',
            virkningsDato: '01-06-2019',
            eetPct: '60',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerAarsag).toBe('folkepensionsdato');
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerDato).toBe('2022-06-30');
      expect(result.computation?.fradragKapitaliseretEet).toBe(0);
      expect(result.computation?.proformaKapitalisering).not.toBeNull();
      expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
    });
  });

  describe('≤ 2 år til folkepension — scenarie 2 (afgørelses­dato ≤ 2 år, virknings­dato > 2 år)', () => {
    // Afgørelsesdato 2021-10-01 er 9 måneder til FP → ≤ 2 år ✓
    // Virkningsdato 2020-01-01 er 30 måneder til FP → > 2 år ✓
    // Kapitaliseringsdato = afgørelsesdato = 2021-10-01, kapPct = 60 (hele EET)
    // Løbende ydelser beregnes fra virkningsdato til dagen før kapitaliseringsdatoen
    // Beregningsdato 2022-09-01 (efter FP)

    it('fradrager løbende ydelser og kapitalbeløb — ingen proformakapitalisering', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-01-2020',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '60',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      const c = result.computation!;

      expect(c.fradragLoebendeYdelser).toBe(336273);

      // Fradrag 2: kapitalbeløb beregnet med særfaktor (≤ 2 år)
      expect(c.fradragKapitaliseretEet).toBe(239221);
      expect(c.kapitaliseringerAfgoerelser[0]?.kapitaliseringspct).toBe(60);
      expect(c.kapitaliseringerAfgoerelser[0]?.kapitalbelob).toBe(239221);

      // Fradrag 3: ingen proforma — hele EET er kapitaliseret (loebendeEetPct = 0)
      expect(c.proformaKapitalisering).toBeNull();

      expect(c.differencekrav).toBeGreaterThan(0);
    });

    it('løbende ydelse ophører ved kapitalisering på afgørelsesdatoen (ikke ved beregningsdato)', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-01-2020',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '60',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      const loebendeAfg = result.computation?.loebendeComputation?.afgoerelser[0];
      expect(loebendeAfg?.ophoerAarsag).toBe('kapitalisering');
      expect(loebendeAfg?.ophoerDato).toBe('2021-09-30');
    });
  });

  describe('≤ 2 år til folkepension — scenarie 3 (afgørelses­dato ≤ 2 år, virknings­dato ≤ 2 år)', () => {
    // Virkningsdato = afgørelsesdato = 2021-10-01 (≤ 2 år til FP)
    // Ingen løbende ydelser (virkningsdato > ophørsdato for løbende)
    // Kun kapitalbeløb fradrages

    it('ingen løbende ydelser, kun kapitalbeløb fradrages, ingen proforma', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '60',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(c.fradragLoebendeYdelser).toBe(0);
      expect(c.fradragKapitaliseretEet).toBe(239221);
      expect(c.proformaKapitalisering).toBeNull();
      expect(c.differencekrav).toBe(983339);
    });
  });

  describe('delvis kapitalisering med proformakapitalisering ved ≤ 2 år', () => {
    // 60 % EET, 30 % kapitaliseret ≤ 2 år til FP, 30 % løbende tilbage
    // Beregningsdato 2021-12-01 (7 mdr til FP → ≤ 2 år) → proforma med særfaktor
    // Virkningsdato = afgørelsesdato = 2021-10-01 → ingen løbende ydelser

    it('proformakapitalisering bruger særfaktor når beregningsdato er ≤ 2 år til FP', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2021-12-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '30',
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(c.fradragLoebendeYdelser).toBe(0);
      expect(c.fradragKapitaliseretEet).toBe(119611);

      // Proforma for 30 % resterende EET med særfaktor (beregningsdato ≤ 2 år til FP)
      expect(c.proformaKapitalisering).not.toBeNull();
      expect(c.proformaKapitalisering!.kapitaliseretPgaUnderToAarTilFp).toBe(true);
      expect(c.proformaKapitalisering!.kapitaliseringsfaktor).toBe(1.245);
      expect(c.proformaKapitalisering!.loebendeEetPct).toBe(30);
      expect(c.proformaKapitalisering!.proformaBeloeb).toBe(119611);

      expect(c.differencekrav).toBeGreaterThan(0);
    });

    it('loebendeEetPct = 0 giver proformaKapitalisering = null', () => {
      // Hele EET er kapitaliseret → ingen løbende EET at proformakapitalisere
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '60',
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(result.computation?.fradragKapitaliseretEet).toBe(239221);
    });

    it('proformakapitaliserer fortsat efter folkepensionsdatoen med særfaktor', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '30',
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadesdato: '2019-04-01',
        fodselsdato: '1955-07-01',
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation?.proformaKapitalisering).not.toBeNull();
      expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
      expect(result.computation?.proformaKapitalisering?.kapitaliseringsfaktor).toBe(1.245);
      expect(result.computation?.proformaKapitalisering?.loebendeEetPct).toBe(30);
      expect(result.computation?.proformaKapitalisering?.proformaBeloeb).toBeGreaterThan(0);
    });
  });

  it('ser bort fra afgørelser der først er truffet eller har virkning efter beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2021-12-01',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '30',
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-02-2022',
            virkningsDato: '01-02-2022',
            eetPct: '80',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1955-07-01',
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.rowId).toBe('a1');
    expect(result.computation?.proformaKapitalisering?.loebendeEetPct).toBe(30);
  });

  it('ser bort fra ufuldstændige afgørelser uden dokumenteret afgørelsesdato og virkningsdato på beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2021-12-01',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: '60',
            kapDato: '01-10-2021',
            kapPct: '30',
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-11-2021',
            virkningsDato: undefined,
            eetPct: '80',
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadesdato: '2019-04-01',
      fodselsdato: '1955-07-01',
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.rowId).toBe('a1');
    expect(result.computation?.proformaKapitalisering?.loebendeEetPct).toBe(30);
  });

  it('proformakapitaliserer med interpolation mod særfaktoren efter tabellens sidste hele alder', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-01-01',
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: '2025-01-01',
          virkningsDato: '2025-01-01',
          eetPct: '50',
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadesdato: '2011-01-01',
      fodselsdato: '1961-11-01',
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.proformaKapitalisering).not.toBeNull();
    expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
    expect(result.computation?.proformaKapitalisering?.kapitaliseringsfaktor).toBe(1.759);
  });
});
