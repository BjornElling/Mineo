import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import * as eetEalCalculation from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { fromKroner, toKroner, type MoneyOre } from '../../../domain/money/money';
import { toISODateString } from '../../../types/branded';

// Fælles stamdata for alle ≤ 2 år-tests i denne fil:
//   skadedato 2019-04-01, fødselsdato 1955-07-01
//   FP = 67 år → folkepensionsdato = 2022-07-01
//   Bekendtgørelse BEK 9921/2019 → særfaktor = 1.245 (67 år, skadedato 2019)

const asAmount = (value: number): AmountValue => ({ kind: 'number', value });
const kroner = (value: MoneyOre | null | undefined): number => value == null ? 0 : toKroner(value);

describe('computeEetDifferencekravCalculation', () => {
  it('emitter en eksplicit blokerende issue når en graf-forudsætning mangler uden kildefejl', () => {
    const spy = vi.spyOn(eetEalCalculation, 'computeEetEalCalculation').mockReturnValue({
      issues: [],
      computation: null,
    });

    try {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2026-12-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1980-01-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.computation).toBeNull();
      expect(result.hasBlockingErrors).toBe(true);
      expect(result.issues).toContainEqual(expect.objectContaining({
        id: 'differencekrav-beregningsgrundlag-missing',
        severity: 'error',
      }));
    } finally {
      spy.mockRestore();
    }
  });

  describe('uden ≤ 2 år til folkepension', () => {
    it('fradrager løbende ydelser til dagen før beregningsdatoen og proformakapitaliserer rest-EET', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2026-12-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2024-01-01'),
            virkningsDato: toISODateString('2024-01-01'),
            eetPct: 60,
            kapDato: toISODateString('2025-01-01'),
            kapPct: 30,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1980-01-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(kroner(result.computation?.fradragLoebendeYdelserOre)).toBeGreaterThan(0);
      expect(kroner(result.computation?.fradragKapitaliseretEetOre)).toBeGreaterThan(0);
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
          beregningsdato: toISODateString('2022-04-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2019-06-01'),
            virkningsDato: toISODateString('2019-06-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerAarsag).toBe('beregningsdato');
      expect(result.computation?.loebendeComputation?.afgoerelser[0]?.ophoerDato).toBe(toISODateString('2022-03-31'));
      expect(kroner(result.computation?.fradragKapitaliseretEetOre)).toBe(0);
      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(result.computation?.resterendeLoebendeYdelser).toEqual({
        loebendeEetPct: 60,
        beregningsdato: toISODateString('2022-04-01'),
        dagenFoerFolkepensionsdato: toISODateString('2022-06-30'),
        aarsydelseOre: fromKroner(194400),
        maanedligYdelseOre: fromKroner(16200),
        tilbageraevendeMaaneder: 3,
        fradragBeloebOre: fromKroner(48600),
      });
      expect(kroner(result.computation?.differencekravOre)).toBe(638230);
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
          beregningsdato: toISODateString('2022-09-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2020-01-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.computation).not.toBeNull();
      const c = result.computation!;

      expect(kroner(c.fradragLoebendeYdelserOre)).toBe(336273);

      // Fradrag 2: kapitalbeløb beregnet med særfaktor (≤ 2 år)
      expect(kroner(c.fradragKapitaliseretEetOre)).toBe(239221);
      expect(c.kapitaliseringerAfgoerelser[0]?.kapitaliseringspct).toBe(60);
      expect(kroner(c.kapitaliseringerAfgoerelser[0]?.kapitalbelobOre)).toBe(239221);

      // Fradrag 3: ingen proforma — hele EET er kapitaliseret (loebendeEetPct = 0)
      expect(c.proformaKapitalisering).toBeNull();

      expect(kroner(c.differencekravOre)).toBeGreaterThan(0);
    });

    it('løbende ydelse ophører ved kapitalisering på afgørelsesdatoen (ikke ved beregningsdato)', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2022-09-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2020-01-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      const loebendeAfg = result.computation?.loebendeComputation?.afgoerelser[0];
      expect(loebendeAfg?.ophoerAarsag).toBe('kapitalisering');
      expect(loebendeAfg?.ophoerDato).toBe(toISODateString('2021-09-30'));
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
          beregningsdato: toISODateString('2022-09-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(kroner(c.fradragLoebendeYdelserOre)).toBe(0);
      expect(kroner(c.fradragKapitaliseretEetOre)).toBe(239221);
      expect(c.proformaKapitalisering).toBeNull();
      expect(kroner(c.differencekravOre)).toBe(983339);
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
          beregningsdato: toISODateString('2021-12-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      const c = result.computation!;

      expect(kroner(c.fradragLoebendeYdelserOre)).toBe(0);
      expect(kroner(c.fradragKapitaliseretEetOre)).toBe(119611);

      expect(c.proformaKapitalisering).toBeNull();
      expect(c.resterendeLoebendeYdelser).toEqual({
        loebendeEetPct: 30,
        beregningsdato: toISODateString('2021-12-01'),
        dagenFoerFolkepensionsdato: toISODateString('2022-06-30'),
        aarsydelseOre: fromKroner(96084),
        maanedligYdelseOre: fromKroner(8007),
        tilbageraevendeMaaneder: 7,
        fradragBeloebOre: fromKroner(56049),
      });
      expect(kroner(c.differencekravOre)).toBe(1031060);
    });

    it('loebendeEetPct = 0 giver proformaKapitalisering = null', () => {
      // Hele EET er kapitaliseret → ingen løbende EET at proformakapitalisere
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2022-09-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 60,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.computation?.proformaKapitalisering).toBeNull();
      expect(kroner(result.computation?.fradragKapitaliseretEetOre)).toBe(239221);
    });

    it('fradrager ikke resterende løbende ydelser efter folkepensionsdatoen', () => {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2022-09-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [{
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2021-12-01'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2022-02-01'),
            virkningsDato: toISODateString('2022-02-01'),
            eetPct: 80,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2021-12-01'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2022-02-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2021-12-01'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-10-01'),
            virkningsDato: toISODateString('2021-10-01'),
            eetPct: 60,
            kapDato: toISODateString('2021-10-01'),
            kapPct: 30,
            afgoerelseType: 'Delvist endelig',
            tidlKapDato: undefined,
          },
          {
            id: 'a2',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2021-11-01'),
            virkningsDato: undefined,
            eetPct: 80,
            kapDato: undefined,
            kapPct: undefined,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2026-01-15'),
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2026-01-15'),
          virkningsDato: toISODateString('2026-01-15'),
          eetPct: 15,
          kapDato: toISODateString('2026-01-15'),
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1978-05-03'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });

    expect(result.issues.some((issue) => issue.id === 'warn-afgoerelsesdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-kap-dato-after-beregningsdato')).toBe(false);
    expect(result.computation?.dagFoerBeregningsdato).toBe(toISODateString('2026-01-14'));
    expect(result.computation?.loebendeComputation?.beregningsdato).toBe(toISODateString('2026-01-14'));
  });

  it('viser dato-advarsler og præcis fejl når alle indtastede afgørelser først har virkning efter beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-01-14'),
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2026-01-15'),
          virkningsDato: toISODateString('2026-01-15'),
          eetPct: 15,
          kapDato: toISODateString('2026-01-15'),
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1978-05-03'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2026-01-14'),
        aslAarsloen: asAmount(339000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: undefined,
          virkningsDato: undefined,
          eetPct: undefined,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: undefined,
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1978-05-03'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });

    expect(result.issues.some((issue) => issue.id === 'asl-afgoerelser-empty')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(false);
  });

  it('viser ikke EAL-fejlen om manglende erhvervsevnetabsprocent når der er indtastet ASL-procent, selv om virkningsdatoen ligger efter beregningsdatoen', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-01-14'),
        aslAarsloen: asAmount(339000),
        ealEetPct: 0,
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2026-01-15'),
          virkningsDato: toISODateString('2026-01-15'),
          eetPct: 15,
          kapDato: toISODateString('2026-01-15'),
          kapPct: 15,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2022-09-17'),
      skadelidteFodselsdato: toISODateString('1978-05-03'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });

    expect(result.issues.some((issue) => issue.id === 'eet-pct-missing')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'warn-virkningsdato-after-beregningsdato')).toBe(false);
    expect(result.issues.some((issue) => issue.id === 'no-asl-afgoerelser-known-at-beregningsdato')).toBe(true);
  });

  it('proformakapitaliserer med interpolation mod særfaktoren efter tabellens sidste hele alder', () => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2026-01-01'),
        aslAarsloen: asAmount(632000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2025-01-01'),
          virkningsDato: toISODateString('2025-01-01'),
          eetPct: 50,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2011-01-01'),
      skadelidteFodselsdato: toISODateString('1961-11-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
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
        beregningsdato: toISODateString('2026-12-01'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2024-01-01'),
          virkningsDato: toISODateString('2024-01-01'),
          eetPct: 60,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });

    expect(result.hasBlockingErrors).toBe(false);
    const proforma = result.computation?.proformaKapitalisering;
    expect(proforma).not.toBeNull();
    expect(kroner(proforma?.grundydelseOre)).toBeGreaterThan(0);
    expect(proforma?.grundydelse2024Ore).not.toBeNull();
    expect(kroner(proforma?.grundydelse2024Ore)).toBeGreaterThan(kroner(proforma?.grundydelseOre));
    expect(proforma?.opreguleringTil2024PctRounded4).toBeGreaterThan(0);
    expect(proforma?.aarsydelseGrundlagOre).toBe(proforma?.grundydelse2024Ore);
    expect(proforma?.aarsydelseReguleringsPctRounded4).toBe(8.9);
    expect(kroner(proforma?.aarsydelseOre)).toBeGreaterThan(kroner(proforma?.aarsydelseGrundlagOre));
  });

  describe('tilbagevirkende kraft — endelig gør midlertidig endelig (toggle)', () => {
    // Brugerens eksempel: midlertidig 55 % (virkning 01-02-2019),
    // endelig 65 % (virkning 01-09-2019, afgjort 01-12-2019).
    // Skade 2015 (>= 16-06-2011), ung skadelidt → ingen ≤ 2 år til FP-komplikationer.
    const buildEksempel = (flag: boolean) =>
      computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2021-03-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [
            {
              id: 'midl',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2019-10-01'),
              virkningsDato: toISODateString('2019-02-01'),
              eetPct: 55,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
            },
            {
              id: 'endelig',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2019-12-01'),
              virkningsDato: toISODateString('2019-09-01'),
              eetPct: 65,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Endelig',
              tidlKapDato: undefined,
            },
          ],
        },
        skadedato: toISODateString('2015-01-01'),
        skadelidteFodselsdato: toISODateString('1980-01-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: flag,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

    it('flag = false: midlertidig fradrages ikke (uændret adfærd)', () => {
      const result = buildEksempel(false);
      expect(result.hasBlockingErrors).toBe(false);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      expect(midl?.afgoerelseType).toBe('Midlertidig');
      expect(midl?.fradragForetages).toBe(false);
      expect(kroner(midl?.beloebOre)).toBe(0);
      expect(midl?.tilbagevirkendeKraftFradrag).toBeNull();
    });

    it('flag = true: midlertidigs egen ydelse fradrages fra endelig-virkning (01-09-2019) og frem', () => {
      const result = buildEksempel(true);
      expect(result.hasBlockingErrors).toBe(false);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      const tvk = midl?.tilbagevirkendeKraftFradrag;
      expect(tvk).not.toBeNull();
      expect(tvk?.endeligVirkningsdato).toBe(toISODateString('2019-09-01'));
      expect(tvk?.fra).toBe(toISODateString('2019-09-01'));
      // Låst kronebeløb: midlertidigs egen 55 %-ydelse for delperioden [01-09-2019, 31-12-2019].
      // Den endelige danner en overlap-periode i samme vindue med bidraget (65−55)=10 %,
      // så summen i vinduet svarer til den endeliges fulde sats uden dobbelttælling.
      expect(tvk).toEqual({
        endeligVirkningsdato: toISODateString('2019-09-01'),
        fra: toISODateString('2019-09-01'),
        til: toISODateString('2019-12-31'),
        beloebOre: fromKroner(60776),
      });
      // Fradraget skal øge det samlede løbende fradrag med præcis tvk-beløbet.
      const off = buildEksempel(false);
      expect(kroner(result.computation?.fradragLoebendeYdelserOre)).toBe(
        kroner(off.computation?.fradragLoebendeYdelserOre) + kroner(tvk?.beloebOre)
      );
      // Differencekravet bliver derfor mindre med flaget slået til (eller forbliver 0).
      expect(kroner(result.computation?.differencekravOre)).toBeLessThanOrEqual(kroner(off.computation?.differencekravOre));
    });

    it('endelig-virkning efter midlertidigs naturlige ophør: ingen TVK, endelig fradrages fuldt fra egen virkning', () => {
      // Geometri-invariant: ligger den endelige virkning EFTER midlertidigs ophør, er der intet
      // overlappende vindue, og der er derfor intet at gøre endeligt med tilbagevirkende kraft.
      // Midlertidigs løbende ydelse afsluttes naturligt dagen før den endeliges cutover (30-09-2019),
      // og den endelige fradrages fuldt fra sin egen virkning (01-10-2019). TVK er hverken nødvendig
      // eller aktiv. Låser fund 2's "ikke-overlap"-tilfælde: faktisk udbetalt midlertidig ydelse
      // dækkes allerede uden TVK, fordi der ikke er noget hul mellem afgørelserne.
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2021-03-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [
            {
              id: 'midl',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2019-02-01'),
              virkningsDato: toISODateString('2019-02-01'),
              eetPct: 55,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
            },
            {
              id: 'endelig',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2019-08-15'),
              virkningsDato: toISODateString('2019-10-01'),
              eetPct: 65,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Endelig',
              tidlKapDato: undefined,
            },
          ],
        },
        skadedato: toISODateString('2015-01-01'),
        skadelidteFodselsdato: toISODateString('1980-01-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: true,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      const endelig = result.computation?.afgoerelser.find((a) => a.rowId === 'endelig');
      // Midlertidigs løbende ydelse stopper dagen før den endeliges cutover.
      expect(result.computation?.loebendeComputation?.afgoerelser.find((a) => a.rowId === 'midl')?.ophoerDato)
        .toBe(toISODateString('2019-09-30'));
      // Ingen TVK, fordi endelig-virkning (01-10-2019) ligger efter midlertidigs ophør (30-09-2019).
      expect(midl?.tilbagevirkendeKraftFradrag).toBeNull();
      expect(kroner(midl?.beloebOre)).toBe(0);
      // Den endelige fradrages fuldt fra sin egen virkning.
      expect(endelig?.fradragForetages).toBe(true);
      expect(kroner(endelig?.beloebOre)).toBe(311582);
      expect(kroner(result.computation?.fradragLoebendeYdelserOre)).toBe(311582);
    });

    it('omvendt rækkefølge: midlertidig truffet efter endelig fradrages stadig (bevidst — rækkefølge gates ikke)', () => {
      // Bevidst designvalg (jf. review): TVK-reglen gates IKKE på, at den midlertidige er truffet
      // før den endelige. Så længe datoerne overlapper, fradrages den midlertidiges egen ydelse.
      // Fane 2 markerer sagen med en advarsel, men blokerer ikke beregningen.
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2021-03-01'),
          aslAarsloen: asAmount(401000),
          aslAfgoerelser: [
            {
              id: 'endelig',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2019-12-01'),
              virkningsDato: toISODateString('2019-09-01'),
              eetPct: 65,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Endelig',
              tidlKapDato: undefined,
            },
            {
              id: 'midl',
              fsTilbageholdtEet: 'Nej',
              afgoerelsesDato: toISODateString('2020-08-01'),
              virkningsDato: toISODateString('2019-06-01'),
              eetPct: 55,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
            },
          ],
        },
        skadedato: toISODateString('2015-01-01'),
        skadelidteFodselsdato: toISODateString('1980-01-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: true,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });

      expect(result.hasBlockingErrors).toBe(false);
      expect(result.issues.some((issue) => issue.id === 'warn-non-endelig-after-endelig')).toBe(true);
      const midl = result.computation?.afgoerelser.find((a) => a.rowId === 'midl');
      expect(midl?.tilbagevirkendeKraftFradrag).toEqual({
        endeligVirkningsdato: toISODateString('2019-09-01'),
        fra: toISODateString('2019-09-01'),
        til: toISODateString('2021-02-28'),
        beloebOre: fromKroner(93874),
      });
    });

    it('skade før 16-06-2011: flaget er en no-op (midlertidig fradrages allerede 100 %)', () => {
      const buildFoer2011 = (flag: boolean) =>
        computeEetDifferencekravCalculation({
          erhvervsevnetab: {
            ...ERHVERVSEVNETAB_INITIAL_VALUES,
            beregningsdato: toISODateString('2021-03-01'),
            aslAarsloen: asAmount(401000),
            aslAfgoerelser: [
              {
                id: 'midl',
                fsTilbageholdtEet: 'Nej',
                afgoerelsesDato: toISODateString('2010-10-01'),
                virkningsDato: toISODateString('2010-02-01'),
                eetPct: 55,
                kapDato: undefined,
                kapPct: undefined,
                afgoerelseType: 'Midlertidig',
                tidlKapDato: undefined,
              },
              {
                id: 'endelig',
                fsTilbageholdtEet: 'Nej',
                afgoerelsesDato: toISODateString('2010-12-01'),
                virkningsDato: toISODateString('2010-09-01'),
                eetPct: 65,
                kapDato: undefined,
                kapPct: undefined,
                afgoerelseType: 'Endelig',
                tidlKapDato: undefined,
              },
            ],
          },
          skadedato: toISODateString('2010-01-01'),
          skadelidteFodselsdato: toISODateString('1980-01-01'),
          endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: flag,
          indregnMerErstatningVedForhoejetPensionsalder: false,
        });

      const off = buildFoer2011(false);
      const on = buildFoer2011(true);
      expect(off.hasBlockingErrors).toBe(false);
      expect(on.hasBlockingErrors).toBe(false);
      // Ingen tilbagevirkende kraft-fradrag uanset flag — midlertidig fradrages allerede via skalFradragForetages.
      expect(on.computation?.afgoerelser.every((a) => a.tilbagevirkendeKraftFradrag === null)).toBe(true);
      expect(on.computation?.fradragLoebendeYdelserOre).toBe(off.computation?.fradragLoebendeYdelserOre);
      expect(on.computation?.differencekravOre).toBe(off.computation?.differencekravOre);
    });
  });
});

describe('computeEetDifferencekravCalculation — fradrag 4 (mer-erstatning ved forhøjet pensionsalder)', () => {
  // Skade 01-01-2012 (post-2011: 83 %, 8 % AM-bidrag), kapitaliseret 25 % den 01-06-2014.
  // Beregningsdato 01-06-2017 → kun 67→68-forhøjelsen (29-12-2015) kvalificerer
  // (2020- og 2025-forhøjelserne ligger efter beregningsdatoen).
  // EAL-krav er stort nok til at differencekravet ikke clampes til 0.
  const build = (toggle: boolean) =>
    computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2017-06-01'),
        aslAarsloen: asAmount(401000),
        ealAarsloen: asAmount(600000),
        ealEetPct: 50,
        koen: 'Mand',
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2014-06-01'),
            virkningsDato: toISODateString('2014-06-01'),
            eetPct: 25,
            kapDato: toISODateString('2014-06-01'),
            kapPct: 25,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2012-01-01'),
      skadelidteFodselsdato: toISODateString('1974-02-28'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: toggle,
    });

  it('trækker præcis samletMerErstatning fra differencekravet når toggle er slået til', () => {
    const on = build(true);
    const off = build(false);

    expect(on.hasBlockingErrors).toBe(false);
    expect(off.hasBlockingErrors).toBe(false);
    expect(on.computation).not.toBeNull();
    expect(off.computation).not.toBeNull();

    // Kun 67→68-forhøjelsen (29-12-2015) kvalificerer på beregningsdato 2017.
    const mer = on.computation!.merErstatningPensionsalder;
    expect(mer).not.toBeNull();
    expect(mer!.events).toHaveLength(1);
    expect(mer!.events[0]!.forhoejelsesdato).toBe(toISODateString('2015-12-29'));
    expect(kroner(mer!.samletMerErstatningOre)).toBeGreaterThan(0);

    // Invariant: differencekravet er ikke clampet til 0 i nogen af tilstandene,
    // så differencen mellem de to skal være præcis den samlede mer-erstatning.
    expect(kroner(on.computation!.differencekravOre)).toBeGreaterThan(0);
    expect(kroner(off.computation!.differencekravOre)).toBeGreaterThan(0);
    expect(kroner(off.computation!.differencekravOre) - kroner(on.computation!.differencekravOre)).toBe(
      kroner(mer!.samletMerErstatningOre)
    );
  });

  it('toggle slået fra: ingen mer-erstatning beregnes og intet fradrag 4 anvendes', () => {
    const off = build(false);
    expect(off.computation?.merErstatningPensionsalder).toBeNull();
  });

  it('fail-closed (tom-liste-gren): ingen forhøjelse kvalificerer → fradrag 4 udeladt, computation forbliver gyldig', () => {
    // Kapitaliseret 01-06-2014, men beregningsdato 01-06-2015 ligger FØR 67→68-forhøjelsen
    // (29-12-2015). Ingen forhøjelse kvalificerer → merErstatningPensionsalder skal være null
    // (ikke et stille 0-fradrag på en tom liste), og differencekravet beregnes uændret.
    const noEvent = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2015-06-01'),
        aslAarsloen: asAmount(401000),
        ealAarsloen: asAmount(600000),
        ealEetPct: 50,
        koen: 'Mand',
        aslAfgoerelser: [
          {
            id: 'a1',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2014-06-01'),
            virkningsDato: toISODateString('2014-06-01'),
            eetPct: 25,
            kapDato: toISODateString('2014-06-01'),
            kapPct: 25,
            afgoerelseType: 'Endelig',
            tidlKapDato: undefined,
          },
        ],
      },
      skadedato: toISODateString('2012-01-01'),
      skadelidteFodselsdato: toISODateString('1974-02-28'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: true,
    });

    expect(noEvent.hasBlockingErrors).toBe(false);
    expect(noEvent.computation).not.toBeNull();
    expect(noEvent.computation!.merErstatningPensionsalder).toBeNull();
    expect(kroner(noEvent.computation!.differencekravOre)).toBeGreaterThan(0);
  });
});

describe('computeEetDifferencekravCalculation — forlig om ansvarsgrad', () => {
  // Genbruger scenarie 1 (≤ 2 år til folkepension), hvor differencekravet uden forlig er 638.230 kr.
  const buildMedForlig = (
    forlig: { factor: number; label: string } | null | undefined,
    forligDato?: ReturnType<typeof toISODateString>,
  ) =>
    computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        beregningsdato: toISODateString('2022-04-01'),
        aslAarsloen: asAmount(401000),
        aslAfgoerelser: [{
          id: 'a1',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString('2019-06-01'),
          virkningsDato: toISODateString('2019-06-01'),
          eetPct: 60,
          kapDato: undefined,
          kapPct: undefined,
          afgoerelseType: 'Endelig',
          tidlKapDato: undefined,
        }],
      },
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
      forlig,
      forligDato,
    });

  it('reducerer det endelige differencekrav med en brøk-faktor og bevarer det fulde krav', () => {
    const result = buildMedForlig({ factor: 2 / 3, label: '2/3' });
    const c = result.computation!;
    expect(kroner(c.differencekravFoerForligOre)).toBe(638230);
    expect(c.forligFactor).toBe(2 / 3);
    expect(c.forligLabel).toBe('2/3');
    expect(c.forligDato).toBeNull();
    // round0(638230 × 2/3) = round0(425486,67) = 425487
    expect(kroner(c.differencekravOre)).toBe(425487);
  });

  it('viderefører forligsdatoen til computation når der reduceres', () => {
    const c = buildMedForlig({ factor: 2 / 3, label: '2/3' }, toISODateString('2024-05-17')).computation!;
    expect(c.forligDato).toBe(toISODateString('2024-05-17'));
  });

  it('viderefører ikke forligsdatoen når der ikke reduceres (100 %)', () => {
    const c = buildMedForlig({ factor: 1, label: '100 %' }, toISODateString('2024-05-17')).computation!;
    expect(c.forligLabel).toBeNull();
    expect(c.forligDato).toBeNull();
  });

  it('reducerer med en procent-faktor', () => {
    const result = buildMedForlig({ factor: 0.5, label: '50 %' });
    const c = result.computation!;
    expect(kroner(c.differencekravFoerForligOre)).toBe(638230);
    expect(c.forligFactor).toBe(0.5);
    expect(c.forligLabel).toBe('50 %');
    expect(kroner(c.differencekravOre)).toBe(319115);
  });

  it('anvender ingen reduktion når forlig er null (intet forlig)', () => {
    const c = buildMedForlig(null).computation!;
    expect(kroner(c.differencekravFoerForligOre)).toBe(638230);
    expect(c.forligFactor).toBeNull();
    expect(c.forligLabel).toBeNull();
    expect(kroner(c.differencekravOre)).toBe(638230);
  });

  it('anvender ingen reduktion når forlig udelades helt (bagudkompatibel)', () => {
    const c = buildMedForlig(undefined).computation!;
    expect(c.forligFactor).toBeNull();
    expect(c.forligLabel).toBeNull();
    expect(c.differencekravOre).toBe(c.differencekravFoerForligOre);
  });

  it('anvender ingen reduktion og ingen parentes-label ved 100 % (factor = 1)', () => {
    const c = buildMedForlig({ factor: 1, label: '100 %' }).computation!;
    expect(kroner(c.differencekravFoerForligOre)).toBe(638230);
    expect(c.forligFactor).toBeNull();
    expect(c.forligLabel).toBeNull();
    expect(kroner(c.differencekravOre)).toBe(638230);
  });
});
