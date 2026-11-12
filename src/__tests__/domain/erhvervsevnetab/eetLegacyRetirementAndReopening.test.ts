import { computeEetDifferencekravCalculation } from '../../../domain/erhvervsevnetab/eetCalculationGraph';
import { computeEetKapitaliseringCalculation } from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { toISODateString } from '../../../types/branded';
import { kapitaliseringsTabelDataById, type KapitaliseringsTabelData } from '../../../data/kapitalisering/kapitaliseringsTabeller';
import { collectEetAslAfgoerelseValidationIssues } from '../../../domain/erhvervsevnetab/eetAslAfgoerelser';
import { computeEetLoebendeYdelser } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { resolveEetIssueNavigation } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { aslAfgoerelseKapDatoField } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';

describe('Ældre skader og genoptagelse ved folkepension', () => {
  it.each(['2020-06-01', '2021-10-01'])('tillader delkapitalisering %s før eller samtidig med senere fuldkapitalisering', (kapDato) => {
    const values = {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2022-12-01'),
      aslAarsloen: { kind: 'number' as const, value: 401000 },
      aslAfgoerelser: [{
        id: 'tidlig',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2019-06-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
        kapDato: toISODateString(kapDato),
        kapPct: 25,
      }, {
        id: 'sen',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2021-10-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
      }],
    };
    const stamdata = {
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    };
    expect(collectEetAslAfgoerelseValidationIssues(values.aslAfgoerelser, stamdata.skadedato, stamdata.skadelidteFodselsdato)).toEqual([]);
    const result = computeEetDifferencekravCalculation({
      ...stamdata, erhvervsevnetab: values,
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.computation?.kapComputation?.afgoerelser.map((row) => row.kapitaliseringspct)).toEqual([25, 35]);
    expect(result.computation?.loebendeComputation?.afgoerelser.map((row) => row.kapPctAktuel)).toEqual([25, 35]);
    expect(result.computation?.loebendeComputation?.afgoerelser[1]?.restEetPct).toBe(0);
    expect(result.computation?.proformaKapitalisering).toBeNull();
  });

  it.each([
    ['2021-10-02', '2019-06-01', '2019-06-01', 'Endelig'],
    ['2022-06-01', '2019-06-01', '2019-06-01', 'Endelig'],
    // Samme afgørelsesdag: virkningsdatoen afgør, hvilken afgørelse der er tidligere.
    ['2022-06-01', '2021-10-01', '2021-09-01', 'Delvist endelig'],
  ] as const)('afviser en tidligere afgørelses kapitalisering %s efter senere fuldkapitalisering', (kapDato, afgoerelsesDato, virkningsDato, afgoerelseType) => {
    const values = {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2022-12-01'),
      aslAarsloen: { kind: 'number' as const, value: 401000 },
      aslAfgoerelser: [{
        id: 'tidlig',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString(afgoerelsesDato),
        virkningsDato: toISODateString(virkningsDato),
        eetPct: 60,
        afgoerelseType,
        kapDato: toISODateString(kapDato),
        kapPct: 25,
      }, {
        id: 'sen',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2021-10-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
      }],
    };
    const stamdata = {
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    };
    const message = 'Kapitaliseringsdatoen skal være senest 01-10-2021, hvor en senere endelig afgørelse kapitaliserer hele det resterende erhvervsevnetab.';
    expect(collectEetAslAfgoerelseValidationIssues(values.aslAfgoerelser, stamdata.skadedato, stamdata.skadelidteFodselsdato))
      .toContainEqual({ rowId: 'tidlig', field: 'kapDato', message });
    expect(resolveEetIssueNavigation('kap-dato-after-later-forced-kapitalisering', {
      ...stamdata,
      aslAfgoerelser: values.aslAfgoerelser,
    })?.focusTarget).toEqual({
      kind: 'fieldAddress', address: aslAfgoerelseKapDatoField.bind('tidlig').address,
    });
    const results = [
      computeEetKapitaliseringCalculation({ ...stamdata, erhvervsevnetab: values }),
      computeEetLoebendeYdelser({ ...stamdata, erhvervsevnetab: values }),
      computeEetDifferencekravCalculation({
        ...stamdata, erhvervsevnetab: values,
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      }),
    ];
    for (const result of results) {
      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual({
        id: 'kap-dato-after-later-forced-kapitalisering', severity: 'error', message,
      });
    }
  });

  it('blokerer en sen endelig afgørelse, når kapitaliseringsdata mangler', () => {
    const dataById = kapitaliseringsTabelDataById as Record<string, KapitaliseringsTabelData | undefined>;
    const original = dataById['9864/2021'];
    dataById['9864/2021'] = undefined;
    try {
      const result = computeEetDifferencekravCalculation({
        erhvervsevnetab: {
          ...ERHVERVSEVNETAB_INITIAL_VALUES,
          beregningsdato: toISODateString('2022-12-01'),
          aslAarsloen: { kind: 'number', value: 401000 },
          aslAfgoerelser: [{
            id: 'sen',
            fsTilbageholdtEet: 'Nej',
            afgoerelsesDato: toISODateString('2022-07-01'),
            eetPct: 60,
            afgoerelseType: 'Endelig',
          }],
        },
        skadedato: toISODateString('2019-04-01'),
        skadelidteFodselsdato: toISODateString('1955-07-01'),
        endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
        indregnMerErstatningVedForhoejetPensionsalder: false,
      });
      expect(result.hasBlockingErrors).toBe(true);
      expect(result.computation).toBeNull();
      expect(result.issues).toContainEqual(expect.objectContaining({
        id: 'kapitaliseringsbekendtgoerelse-missing-control-date',
        severity: 'error',
      }));
    } finally {
      dataById['9864/2021'] = original;
    }
  });

  it.each(['2014-01-01', '2021-01-01'])('kræver ikke køn til en kønsneutral særfaktor ved kapitalisering %s', (dato) => {
    const result = computeEetKapitaliseringCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        aslAarsloen: { kind: 'number', value: 300000 },
        aslAfgoerelser: [{
          id: 'a',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString(dato),
          virkningsDato: toISODateString('2013-01-01'),
          eetPct: 60,
          afgoerelseType: 'Endelig',
          kapDato: toISODateString(dato),
          kapPct: 60,
          tidlKapDato: dato === '2014-01-01' ? undefined : toISODateString('2014-01-01'),
        }],
      },
      skadedato: toISODateString('2007-07-01'),
      skadelidteFodselsdato: toISODateString('1950-07-01'),
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
    expect(result.computation?.afgoerelser[0]?.koenOpdelt).toBe(false);
  });

  it.each([
    ['2020-07-01', 25, 30245400],
    ['2020-07-01', 60, 72583800],
    ['2022-07-01', 25, 30949800],
    ['2022-07-02', 60, 74277000],
  ])('bevarer kun løbende ydelser ved gammel skade og afgørelse %s med %s procent', (dato, eetPct, forventetLoebendeOre) => {
    const result = computeEetDifferencekravCalculation({
      erhvervsevnetab: {
        ...ERHVERVSEVNETAB_INITIAL_VALUES,
        koen: 'Mand',
        beregningsdato: toISODateString('2022-12-01'),
        aslAarsloen: { kind: 'number', value: 300000 },
        aslAfgoerelser: [{
          id: 'gammel',
          fsTilbageholdtEet: 'Nej',
          afgoerelsesDato: toISODateString(dato),
          virkningsDato: toISODateString('2019-01-01'),
          eetPct,
          afgoerelseType: 'Endelig',
        }],
      },
      skadedato: toISODateString('2005-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.hasBlockingErrors).toBe(false);
    expect(result.computation?.fradragKapitaliseretEetOre).toBe(0);
    // Grundløn 284.496 kr. Ved 25 % er månedssatserne i 2020–2022 hhv.
    // 7.118, 7.284 og 7.369 kr.; ved 60 % hhv. 17.082, 17.480 og 17.685 kr.
    // Afgørelse i 2020: 24 + 12 + 6 mdr. Afgørelse i 2022: 42 mdr. med 2022-satsen.
    expect(result.computation?.fradragLoebendeYdelserOre).toBe(forventetLoebendeOre);
    expect(result.computation?.afgoerelser[0]?.fradragesTil).toBe('2022-06-30');
    expect(result.computation?.proformaKapitalisering).toBeNull();
    expect(result.computation?.resterendeLoebendeYdelser).toBeNull();
  });

  it('bevarer restydelsen og den tidligere faktor ved genoptagelse inden for to år', () => {
    const values = {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2022-04-01'),
      aslAarsloen: { kind: 'number' as const, value: 401000 },
      aslAfgoerelser: [{
        id: 'genoptaget',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2021-10-01'),
        virkningsDato: toISODateString('2019-06-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
        kapDato: toISODateString('2021-10-01'),
        kapPct: 30,
        tidlKapDato: toISODateString('2019-06-01'),
      }],
    };
    const stamdata = {
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    };
    const result = computeEetDifferencekravCalculation({
      ...stamdata,
      erhvervsevnetab: values,
      endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft: false,
      indregnMerErstatningVedForhoejetPensionsalder: false,
    });
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    const kap = result.computation?.kapComputation?.afgoerelser[0];
    expect(kap?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
    expect(kap?.kapitaliseringspct).toBe(30);
    expect(kap?.kapitaliseringsdato).toBe('2021-10-01');
    expect(kap?.tidligereKapitaliseringsdato).toBe('2019-06-01');
    // Bkg. 1233/2018 tabel B: 63 år = 2,432 og 64 år = 1,842.
    // Ved 63 år 11 mdr.: round3((2,432 + 11 × 1,842) / 12) = 1,891.
    expect(kap?.kapitaliseringsfaktor).toBe(1.891);
    expect(kap?.kapitaliseringsbekendtgoerelseLabel).toBe('Bkg. 1233/2018, tabel B');
    // 2021-årsydelse 96.072,68 kr. × 1,891, oprundet til hele kroner.
    expect(kap?.aarsydelseOre).toBe(9607268);
    expect(kap?.kapitalbelobOre).toBe(18167400);
    expect(kap?.alderAar).toBe(63);
    expect(kap?.alderMaaneder).toBe(11);
    expect(result.computation?.loebendeComputation?.afgoerelser[0]?.restEetPct).toBe(30);
    expect(result.computation?.afgoerelser[0]?.fradragesTil).toBe('2022-03-31');
    expect(result.computation?.proformaKapitalisering?.loebendeEetPct).toBe(30);
  });
});
