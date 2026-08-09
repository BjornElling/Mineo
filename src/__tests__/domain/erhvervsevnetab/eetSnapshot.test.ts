import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshotForTest as computeEetSnapshot } from '../../utils/eetSnapshotTestSupport';
import * as eetLoebendeYdelserCalculation from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import { toKroner } from '../../../domain/money/money';

const createValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  koen: 'Kvinde',
  aslAarsloen: { kind: 'number', value: 600000 },
  ealAarsloen: { kind: 'number', value: 600000 },
  ealEetPct: 25,
  aslAfgoerelser: [
    {
      id: 'row-1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: 25,
      kapDato: toISODateString('2026-03-01'),
      kapPct: 10,
      afgoerelseType: 'Endelig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
  ],
});

const createStamdata = (): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: toISODateString('2024-07-01'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
});

describe('computeEetSnapshot', () => {
  it('blokerer alle projektioner ved skadedato før fødselsdato uden monteret stamdata-side', () => {
    const values = {
      ...createValues(),
      skadelidteFodselsdato: toISODateString('2025-01-01'),
    };
    const snapshot = computeEetSnapshot({
      values,
      stamdata: {
        ...createStamdata(),
        skadelidteFodselsdato: toISODateString('2025-01-01'),
        skadedato: toISODateString('2024-07-01'),
      },
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {},
        faellesAarsloen: {},
      },
    });

    expect(snapshot.loebendeYdelser.hasBlockingErrors).toBe(true);
    expect(snapshot.kapitalisering.hasBlockingErrors).toBe(true);
    expect(snapshot.efterEal.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.loebendeYdelser.issues).toContainEqual(expect.objectContaining({
      id: 'stamdata-date-order:skadedato',
      severity: 'error',
    }));
  });

  it('samler alle tab-beregninger i ét autoritativt snapshot', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {},
        faellesAarsloen: {},
      },
    });

    expect(snapshot.loebendeYdelser.computation).not.toBeNull();
    expect(snapshot.kapitalisering.computation).not.toBeNull();
    expect(snapshot.efterEal.computation).not.toBeNull();
    expect(snapshot.differencekrav.computation).not.toBeNull();
    expect(snapshot.loebendeYdelser.hasBlockingErrors).toBe(false);
    expect(snapshot.kapitalisering.hasBlockingErrors).toBe(false);
    expect(snapshot.efterEal.hasBlockingErrors).toBe(false);
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(false);
  });

  it('propagerer feltfejl ind i alle relevante tab-projektioner', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {
          beregningsdato: { message: 'Beregningsdato mangler i UI' },
        },
        faellesAarsloen: {},
      },
    });

    expect(snapshot.loebendeYdelser.hasBlockingErrors).toBe(true);
    expect(snapshot.efterEal.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.loebendeYdelser.issues.some((issue) => issue.id === 'field-beregningsdato')).toBe(true);
    expect(snapshot.efterEal.issues.some((issue) => issue.id === 'field-beregningsdato')).toBe(true);
    expect(snapshot.differencekrav.issues.some((issue) => issue.id === 'field-beregningsdato')).toBe(true);
  });

  it('viser manglende beregningsdato præcis én gang på Differencekrav', () => {
    const snapshot = computeEetSnapshot({
      values: {
        ...createValues(),
        beregningsdato: undefined,
      },
      stamdata: createStamdata(),
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {},
        faellesAarsloen: {},
      },
    });

    const beregningsdatoIssues = snapshot.differencekrav.issues.filter(
      (issue) => issue.id === 'beregningsdato-missing'
    );

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.computation).toBeNull();
    expect(beregningsdatoIssues).toEqual([{
      id: 'beregningsdato-missing',
      severity: 'error',
      message: 'Beregningsdato er ikke udfyldt',
    }]);
  });

  it('et blokeret panel har ALTID computation null — motoren må ikke have kørt på et maskeret input', () => {
    // INVARIANT (`form-contract.md` §2.3, `error-contract.md` §5): kun en ready projektion må fodre motoren.
    //
    // Denne test hed tidligere "hasBlockingErrors er true men computation er ikke null" og dokumenterede
    // dermed netop det brud, den nu udelukker: motorerne kørte med readerens MASKEREDE værdier (en rød værdi
    // er `undefined` for motoren), hvorefter resultatet kun blev skjult af UI-laget. Et resultat udregnet på
    // et falsk input må ikke eksistere i snapshottet — heller ikke bag en UI-guard.
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {
          beregningsdato: { message: 'Beregningsdato mangler' },
        },
        faellesAarsloen: {},
      },
    });

    for (const panel of [snapshot.loebendeYdelser, snapshot.efterEal, snapshot.differencekrav]) {
      expect(panel.hasBlockingErrors).toBe(true);
      expect(panel.computation).toBeNull();
    }
  });

  it('kapitalisering påvirkes ikke af beregningsdato-feltfejl — feltet er ikke i kapitaliseringens projektion', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {
          beregningsdato: { message: 'Beregningsdato mangler' },
        },
        faellesAarsloen: {},
      },
    });

    // beregningsdato er ikke i buildKapitaliseringProjection's field-mapping
    expect(snapshot.kapitalisering.issues.some((issue) => issue.id === 'field-beregningsdato')).toBe(false);
    // Kapitalisering blokeres derfor ikke af beregningsdato-feltfejl alene
    expect(snapshot.kapitalisering.hasBlockingErrors).toBe(false);
    expect(snapshot.kapitalisering.computation).not.toBeNull();
  });

  it('differencekrav hasBlockingErrors afspejler beregnermotorens error-issues', () => {
    // Scenarie: stamdata mangler → skadedato er undefined → differencekrav-beregneren
    // returnerer en error-issue og computation: null. Snapshot-projektionen udleder
    // blocking-status af den samme issue-liste.
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: null, // ingen stamdata → skadedato er undefined
      fieldErrors: {
        stamdata: {},
        erhvervsevnetab: {},
        faellesAarsloen: {},
      },
    });

    expect(snapshot.differencekrav.computation).toBeNull();
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
  });

  it('anvender et gyldigt forlig på differencekravet uden at blokere', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3' },
        dato: toISODateString('2024-05-17'),
        hasRejectedInput: false,
      },
    });

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(false);
    // Faktoren (og datoen) flyder igennem snapshot → beregning (selve reduktions-matematikken er
    // dækket i eetDifferencekravCalculation-testen på et ikke-nul scenarie).
    const c = snapshot.differencekrav.computation!;
    expect(c.forligLabel).toBe('2/3');
    expect(c.forligFactor).toBe(2 / 3);
    expect(c.forligDato).toBe(toISODateString('2024-05-17'));
    expect(toKroner(c.differencekravOre)).toBe(
      Math.max(0, Math.round(toKroner(c.differencekravFoerForligOre) * (2 / 3)))
    );
  });

  it('blokerer hele differencekrav-outputtet når både procent og brøk er udfyldt', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3' },
        hasRejectedInput: false,
      },
    });

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.issues.some((issue) => issue.id === 'forlig-ansvarsgrad-invalid')).toBe(true);
    // Øvrige faner berøres ikke af forligs-fejlen.
    expect(snapshot.efterEal.hasBlockingErrors).toBe(false);
  });

  it('blokerer differencekrav-outputtet når et forligs-felt har et ikke-committbart rå draft', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: undefined },
        hasRejectedInput: true,
      },
    });

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.issues.some((issue) => issue.id === 'forlig-ansvarsgrad-invalid')).toBe(true);
  });

  it('blokerer kun differencekravet, når den delte forligsdato har en feltfejl', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: undefined },
        datoErrorMessage: 'Forligsdatoen er ugyldig',
        hasRejectedInput: false,
      },
    });

    expect(snapshot.differencekrav.issues).toContainEqual(expect.objectContaining({ id: 'field-forlig-dato' }));
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.loebendeYdelser.issues.some((issue) => issue.id === 'field-forlig-dato')).toBe(false);
    expect(snapshot.kapitalisering.issues.some((issue) => issue.id === 'field-forlig-dato')).toBe(false);
    expect(snapshot.efterEal.issues.some((issue) => issue.id === 'field-forlig-dato')).toBe(false);
  });

  it('failer lukket med snapshot-issue hvis en EET-beregner kaster runtimefejl', () => {
    const spy = vi.spyOn(eetLoebendeYdelserCalculation, 'computeEetLoebendeYdelser').mockImplementation(() => {
      throw new Error('Injected EET failure');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const snapshot = computeEetSnapshot({
        values: createValues(),
        stamdata: createStamdata(),
        fieldErrors: {
          stamdata: {},
          erhvervsevnetab: {},
          faellesAarsloen: {},
        },
      });

      expect(snapshot.loebendeYdelser.computation).toBeNull();
      expect(snapshot.loebendeYdelser.hasBlockingErrors).toBe(true);
      expect(snapshot.loebendeYdelser.issues).toContainEqual(expect.objectContaining({
        id: 'runtime-exception',
        severity: 'error',
      }));
    } finally {
      spy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });
});
