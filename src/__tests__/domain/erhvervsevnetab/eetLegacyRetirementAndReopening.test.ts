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
        // ≤ 2 år til folkepension: afgørelsesdatoen og hele det resterende EET er obligatoriske.
        kapDato: toISODateString('2021-10-01'),
        kapPct: 35,
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

  it('lægger en senere kapitaliseringsdato til grund ved ≤ 2 år til folkepension (udviklerafgørelse 2026-11-13)', () => {
    const values = {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2022-12-01'),
      aslAarsloen: { kind: 'number' as const, value: 401000 },
      aslAfgoerelser: [{
        id: 'sen',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2021-10-01'),
        virkningsDato: toISODateString('2021-01-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
        kapDato: toISODateString('2021-12-01'),
        kapPct: 60,
      }],
    };
    const stamdata = {
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1955-07-01'),
    };
    expect(collectEetAslAfgoerelseValidationIssues(values.aslAfgoerelser, stamdata.skadedato, stamdata.skadelidteFodselsdato)).toEqual([]);
    const kap = computeEetKapitaliseringCalculation({ ...stamdata, erhvervsevnetab: values });
    expect(kap.computation?.afgoerelser[0]?.kapitaliseringsdato).toBe('2021-12-01');
    expect(kap.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
    const loebende = computeEetLoebendeYdelser({ ...stamdata, erhvervsevnetab: values });
    expect(loebende.computation?.afgoerelser[0]?.ophoerDato).toBe('2020-06-30');
    expect(loebende.computation?.afgoerelser[0]?.ophoerAarsag).toBe('to-aarsgraense');
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
            kapDato: toISODateString('2022-07-01'),
            kapPct: 60,
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

  it('viser kønsmanglen, når en senere kapitaliseringsdato ikke ændrer valget af kønsopdelt faktor', () => {
    const values = {
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      aslAarsloen: { kind: 'number' as const, value: 300000 },
      aslAfgoerelser: [{
        id: 'senere-kapitalisering',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2013-01-01'),
        virkningsDato: toISODateString('2013-01-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
        kapDato: toISODateString('2014-01-01'),
        kapPct: 30,
      }],
    };
    const stamdata = {
      skadedato: toISODateString('2007-07-01'),
      skadelidteFodselsdato: toISODateString('1950-07-01'),
    };
    const missing = computeEetKapitaliseringCalculation({ ...stamdata, erhvervsevnetab: values });
    expect(missing.computation).toBeNull();
    // Kapitaliseringen 01-01-2014 ligger inden for toårsvinduet (fra 01-07-2013) uden at være påkrævet.
    expect(missing.issues.map((issue) => issue.id)).toEqual(['warn-kap-dato-inden-for-to-aar-til-fp', 'missing-koen']);
    const ready = computeEetKapitaliseringCalculation({
      ...stamdata, erhvervsevnetab: { ...values, koen: 'Mand' },
    });
    expect(ready.issues.map((issue) => issue.id)).toEqual(['warn-kap-dato-inden-for-to-aar-til-fp']);
    expect(ready.computation?.afgoerelser[0]?.kapitaliseringsfaktor).toBe(1.168);
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

  // Udviklerafgørelse 2026-11-13: ved genoptagelse fra 1. juli 2024 styrer den nye afgørelsesdato
  // regelvalg og faktor. Født 01-01-1959: folkepension 01-01-2026, toårsgrænse 01-01-2024.
  describe('genoptagelse fra 1. juli 2024', () => {
    const stamdata = {
      skadedato: toISODateString('2019-04-01'),
      skadelidteFodselsdato: toISODateString('1959-01-01'),
    };
    const genoptaget = (kapPct: number) => ({
      ...ERHVERVSEVNETAB_INITIAL_VALUES,
      beregningsdato: toISODateString('2025-10-01'),
      aslAarsloen: { kind: 'number' as const, value: 401000 },
      aslAfgoerelser: [{
        id: 'genoptaget',
        fsTilbageholdtEet: 'Nej' as const,
        afgoerelsesDato: toISODateString('2025-07-01'),
        virkningsDato: toISODateString('2019-06-01'),
        eetPct: 60,
        afgoerelseType: 'Endelig' as const,
        kapDato: toISODateString('2025-09-01'),
        kapPct,
        tidlKapDato: toISODateString('2021-06-01'),
      }],
    });

    it('kræver hele EET kapitaliseret med særfaktor, selv om den tidligere dato lå over to år før', () => {
      expect(collectEetAslAfgoerelseValidationIssues(genoptaget(30).aslAfgoerelser, stamdata.skadedato, stamdata.skadelidteFodselsdato))
        .toContainEqual(expect.objectContaining({ field: 'kapPct' }));
      const kap = computeEetKapitaliseringCalculation({ ...stamdata, erhvervsevnetab: genoptaget(60) });
      expect(kap.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      const afgoerelse = kap.computation?.afgoerelser[0];
      expect(afgoerelse?.kapitaliseretPgaUnderToAarTilFp).toBe(true);
      expect(afgoerelse?.kapitaliseringspct).toBe(60);
      expect(afgoerelse?.kapitaliseringsdato).toBe('2025-09-01');
      // Den tidligere dato bærer ikke længere faktorgrundlaget og vises derfor ikke som sådan.
      expect(afgoerelse?.tidligereKapitaliseringsdato).toBeNull();
      expect([afgoerelse?.alderAar, afgoerelse?.alderMaaneder]).toEqual([66, 6]);
    });

    it('stopper de løbende ydelser dagen før toårsgrænsen', () => {
      const loebende = computeEetLoebendeYdelser({ ...stamdata, erhvervsevnetab: genoptaget(60) });
      expect(loebende.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(loebende.computation?.afgoerelser[0]?.ophoerDato).toBe('2023-12-31');
      expect(loebende.computation?.afgoerelser[0]?.ophoerAarsag).toBe('to-aarsgraense');
    });

    it('bevarer den tidligere dato som kontroltidspunkt ved en afgørelse dagen før skæringsdatoen', () => {
      const values = genoptaget(30);
      const foer = {
        ...values,
        aslAfgoerelser: values.aslAfgoerelser.map((row) => ({
          ...row, afgoerelsesDato: toISODateString('2024-06-30'), kapDato: toISODateString('2024-06-30'),
        })),
      };
      const kap = computeEetKapitaliseringCalculation({ ...stamdata, erhvervsevnetab: foer });
      expect(kap.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
      expect(kap.computation?.afgoerelser[0]?.kapitaliseretPgaUnderToAarTilFp).toBe(false);
      expect(kap.computation?.afgoerelser[0]?.tidligereKapitaliseringsdato).toBe('2021-06-01');
    });
  });
});
