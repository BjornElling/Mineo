import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetDifferencekravCalculation';

// Fælles stamdata for alle ≤ 2 år-tests i denne fil:
//   skadedato 2019-04-01, fødselsdato 1955-07-01
//   FP = 67 år → folkepensionsdato = 2022-07-01
//   Bekendtgørelse BEK 9921/2019 → særfaktor = 1.245 (67 år, skadedato 2019)

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
            eetPct: 60,
            kapDato: '01-01-2025',
            kapPct: 30,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1980-01-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(result.computation?.fradragLoebendeYdelser).toBeGreaterThan(0);
      expect(result.computation?.fradragKapitaliseretEet).toBeGreaterThan(0);
      expect(result.computation?.proformaKapitalisering).not.toBeNull();
      expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
      expect(result.computation?.resterendeLoebendeYdelser).toBeNull();
    });
  });

  describe('≤ 2 år til folkepension — scenarie 1 (afgørelsesdato > 2 år før FP)', () => {
    it('fradrager løbende ydelser og resterende løbende ydelser frem til folkepensionsdatoen', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-04-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-06-2019',
            virkningsDato: '01-06-2019',
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerAarsag).toBe('beregningsdato');
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerDato).toBe('2022-03-31');
      expect(result.computation?.fradragKapitaliseretEet).toBe(0);
      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(result.computation?.resterendeLoebendeYdelser).toEqual({
        loebendeEetPct: 60,
        beregningsdato: '2022-04-01',
        dagenFoerFolkepensionsdato: '2022-06-30',
        aarsydelse: 194400,
        maanedligYdelse: 16200,
        tilbageraevendeMaaneder: 3,
        fradragBeloeb: 48600,
      });
      expect(result.computation?.differencekrav).toBe(638230);
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(c.fradragLoebendeYdelser).toBe(0);
      expect(c.fradragKapitaliseretEet).toBe(239221);
      expect(c.proformaKapitalisering).toBeNull();
      expect(c.differencekrav).toBe(983339);
    });
  });

  describe('delvis kapitalisering med resterende løbende ydelser ved ≤ 2 år', () => {
    // 60 % EET, 30 % kapitaliseret ≤ 2 år til FP, 30 % løbende tilbage
    // Beregningsdato 2021-12-01 (7 mdr til FP → ≤ 2 år) → resterende løbende ydelser
    // Virkningsdato = afgørelsesdato = 2021-10-01 → ingen løbende ydelser

    it('resterende del behandles som løbende ydelse når beregningsdato er ≤ 2 år til FP', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2021-12-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(c.fradragLoebendeYdelser).toBe(0);
      expect(c.fradragKapitaliseretEet).toBe(119611);

      expect(c.proformaKapitalisering).toBeNull();
      expect(c.resterendeLoebendeYdelser).toEqual({
        loebendeEetPct: 30,
        beregningsdato: '2021-12-01',
        dagenFoerFolkepensionsdato: '2022-06-30',
        aarsydelse: 96084,
        maanedligYdelse: 8007,
        tilbageraevendeMaaneder: 7,
        fradragBeloeb: 56049,
      });
      expect(c.differencekrav).toBe(1031060);
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(result.computation?.fradragKapitaliseretEet).toBe(239221);
    });

    it('fradrager ikke resterende løbende ydelser efter folkepensionsdatoen', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2022-09-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            afgoerelsesDato: '01-10-2021',
            virkningsDato: '01-10-2021',
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: '2019-04-01',
        skadelidteFodselsdato: '1955-07-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(result.computation?.resterendeLoebendeYdelser).toBeNull();
    });
  });

  it('ser bort fra afgørelser der har virkning efter beregningsdatoen', () => {
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-02-2022',
            virkningsDato: '01-02-2022',
            eetPct: 80,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: '2019-04-01',
      skadelidteFodselsdato: '1955-07-01',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.rowId).toBe('a1');
    expect(result.computation?.proformaKapitalisering).toBeNull();
    expect(result.computation?.resterendeLoebendeYdelser?.loebendeEetPct).toBe(30);
  });

  it('afgrænser ikke længere på afgørelsesdato når virkningsdatoen er på eller før beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2021-12-01',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            afgoerelsesDato: '01-02-2022',
            virkningsDato: '01-10-2021',
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: '2019-04-01',
      skadelidteFodselsdato: '1955-07-01',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(false);
    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.rowId).toBe('a1');
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
            eetPct: 60,
            kapDato: '01-10-2021',
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            afgoerelsesDato: '01-11-2021',
            virkningsDato: undefined,
            eetPct: 80,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: '2019-04-01',
      skadelidteFodselsdato: '1955-07-01',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.afgoerelser).toHaveLength(1);
    expect(result.computation?.afgoerelser[0]?.rowId).toBe('a1');
    expect(result.computation?.proformaKapitalisering).toBeNull();
    expect(result.computation?.resterendeLoebendeYdelser?.loebendeEetPct).toBe(30);
  });

  it('vurderer beregningsdato-advarsler mod den brugerangivne beregningsdato selv om løbende fradrag stopper dagen før', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-01-15',
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: '15-01-2026',
          virkningsDato: '15-01-2026',
          eetPct: 15,
          kapDato: '15-01-2026',
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2022-09-17',
      skadelidteFodselsdato: '1978-05-03',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(false);
    expect(result.computation?.dagFoerBeregningsdato).toBe('2026-01-14');
    expect(result.computation?.loebendeComputation?.beregningsdato).toBe('2026-01-14');
  });

  it('viser dato-advarsler og præcis fejl når alle indtastede afgørelser først har virkning efter beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-01-14',
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: '15-01-2026',
          virkningsDato: '15-01-2026',
          eetPct: 15,
          kapDato: '15-01-2026',
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2022-09-17',
      skadelidteFodselsdato: '1978-05-03',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'asl-afgoerelser-empty')).toBe(false);
    expect(result.computation).toBeNull();
    expect(result.hasBlockingErrors).toBe(true);
  });

  it('viser kun tom-fejl når der ikke findes nogen gyldige ASL-afgørelser overhovedet', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-01-14',
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: undefined,
          virkningsDato: undefined,
          eetPct: undefined,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: undefined,
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2022-09-17',
      skadelidteFodselsdato: '1978-05-03',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.issues.some((issue) => issue.id === 'asl-afgoerelser-empty')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(false);
  });

  it('viser ikke EAL-fejlen om manglende erhvervsevnetabsprocent når der er indtastet ASL-procent, selv om virkningsdatoen ligger efter beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-01-14',
        aslAarsloen: asAmount(339000),
        ealEetPct: 0,
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: '15-01-2026',
          virkningsDato: '15-01-2026',
          eetPct: 15,
          kapDato: '15-01-2026',
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2022-09-17',
      skadelidteFodselsdato: '1978-05-03',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.issues.some((issue) => issue.id === 'eet-pct-missing')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(true);
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
          eetPct: 50,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2011-01-01',
      skadelidteFodselsdato: '1961-11-01',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.proformaKapitalisering).not.toBeNull();
    expect(result.computation?.proformaKapitalisering?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
    expect(result.computation?.proformaKapitalisering?.kapitaliseringsfaktor).toBe(1.759);
  });

  it('splitter proformakapitaliseringens opregulering i 2003→2024 og 2024→målår, når beregningen ligger i 2026', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: '2026-12-01',
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [{
          id: 'a1',
          afgoerelsesDato: '01-01-2024',
          virkningsDato: '01-01-2024',
          eetPct: 60,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: '2019-04-01',
      skadelidteFodselsdato: '1980-01-01',
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
    });

    expect(result.hasBlockingErrors).toBe(false);
    const proforma = result.computation?.proformaKapitalisering;
    expect(proforma).not.toBeNull();
    expect(proforma?.grundydelse).toBeGreaterThan(0);
    expect(proforma?.grundydelse2024).not.toBeNull();
    expect(proforma?.grundydelse2024).toBeGreaterThan(proforma?.grundydelse ?? 0);
    expect(proforma?.opreguleringTil2024PctRounded4).toBeGreaterThan(0);
    expect(proforma?.aarsydelseGrundlag).toBe(proforma?.grundydelse2024);
    expect(proforma?.aarsydelseReguleringsPctRounded4).toBe(8.9);
    expect(proforma?.aarsydelse).toBeGreaterThan(proforma?.aarsydelseGrundlag ?? 0);
  });

  describe('tilbagevirkende kraft — endelig gør midlertidig endelig (toggle)', () => {
    // Brugerens eksempel: midlertidig 55 % (virkning 01-02-2019),
    // endelig 65 % (virkning 01-09-2019, afgjort 01-12-2019).
    // Skade 2015 (>= 16-06-2011), ung skadelidt → ingen ≤ 2 år til FP-komplikationer.
    const buildEksempel = (flag: boolean) =>
      computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: '2021-03-01',
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [
            {
              id: 'midl',
              afgoerelsesDato: '01-10-2019',
              virkningsDato: '01-02-2019',
              eetPct: 55,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
            },
            {
              id: 'endelig',
              afgoerelsesDato: '01-12-2019',
              virkningsDato: '01-09-2019',
              eetPct: 65,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Endelig',
              tidlKapDato: undefined,
            },
          ],
        },
        skadedato: '2015-01-01',
        skadelidteFodselsdato: '1980-01-01',
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: flag,
      });

    it('flag = false: midlertidig fradrages ikke (uændret adfærd)', () => {
      const result = buildEksempel(false);
      expect(result.hasBlockingErrors).toBe(false);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      expect(midl?.afgoerelseType).toBe('Midlertidig');
      expect(midl?.fradragForetages).toBe(false);
      expect(midl?.beloeb).toBe(0);
      expect(midl?.tilbagevirkendeKraftFradrag).toBeNull();
    });

    it('flag = true: midlertidigs egen ydelse fradrages fra endelig-virkning (01-09-2019) og frem', () => {
      const result = buildEksempel(true);
      expect(result.hasBlockingErrors).toBe(false);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      const tvk = midl?.tilbagevirkendeKraftFradrag;
      expect(tvk).not.toBeNull();
      expect(tvk?.endeligVirkningsdato).toBe('2019-09-01');
      expect(tvk?.fra).toBe('2019-09-01');
      expect(tvk?.beloeb).toBeGreaterThan(0);
      // Fradraget skal øge det samlede løbende fradrag med præcis tvk-beløbet.
      const off = buildEksempel(false);
      expect(result.computation?.fradragLoebendeYdelser).toBe(
        (off.computation?.fradragLoebendeYdelser ?? 0) + (tvk?.beloeb ?? 0)
      );
      // Differencekravet bliver derfor mindre med flaget slået til (eller forbliver 0).
      expect(result.computation?.differencekrav ?? 0).toBeLessThanOrEqual(off.computation?.differencekrav ?? 0);
    });

    it('skade før 16-06-2011: flaget er en no-op (midlertidig fradrages allerede 100 %)', () => {
      const buildFoer2011 = (flag: boolean) =>
        computeEetDifferencekravCalculation({
          erhvervsevnetab: {
            ...ERHVERVSEVNETAB_INITIAL_VALUES,
            beregningsdato: '2021-03-01',
            aslAarsloen: asAmount(401000),
            aslAfgoerelser: [
              {
                id: 'midl',
                afgoerelsesDato: '01-10-2010',
                virkningsDato: '01-02-2010',
                eetPct: 55,
                kapDato: undefined,
                kapPct: undefined,
                afgoerelseType: 'Midlertidig',
                tidlKapDato: undefined,
              },
              {
                id: 'endelig',
                afgoerelsesDato: '01-12-2010',
                virkningsDato: '01-09-2010',
                eetPct: 65,
                kapDato: undefined,
                kapPct: undefined,
                afgoerelseType: 'Endelig',
                tidlKapDato: undefined,
              },
            ],
          },
          skadedato: '2010-01-01',
          skadelidteFodselsdato: '1980-01-01',
          endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: flag,
        });

      const off = buildFoer2011(false);
      const on = buildFoer2011(true);
      expect(off.hasBlockingErrors).toBe(false);
      expect(on.hasBlockingErrors).toBe(false);
      // Ingen tilbagevirkende kraft-fradrag uanset flag — midlertidig fradrages allerede via skalFradragForetages.
      expect(on.computation?.afgoerelser.every((a) => a.tilbagevirkendeKraftFradrag === null)).toBe(true);
      expect(on.computation?.fradragLoebendeYdelser).toBe(off.computation?.fradragLoebendeYdelser);
      expect(on.computation?.differencekrav).toBe(off.computation?.differencekrav);
    });
  });
});
