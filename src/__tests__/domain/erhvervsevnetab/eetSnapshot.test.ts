import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import * as eetLoebendeYdelserCalculation from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

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

  it('hasBlockingErrors er true men computation er ikke null — tab-laget er ansvarlig for begge guards', () => {
    // Beregnermotorerne kører altid med de committed values — en feltfejl i UI blokerer ikke
    // motorernes udregning, den sætter kun hasBlockingErrors via issues.some(). Computation
    // returneres selv ved hasBlockingErrors: true. Tab-laget renderer med !hasBlockingErrors && computation.
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

    expect(snapshot.loebendeYdelser.hasBlockingErrors).toBe(true);
    // computation er ikke null: motoren kørte med de committed values, som er gyldige
    expect(snapshot.loebendeYdelser.computation).not.toBeNull();
    // Tab-laget beskytter visning med !hasBlockingErrors && computation — begge guards er nødvendige
    expect(snapshot.efterEal.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
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

  it('differencekrav hasBlockingErrors fanger blocking fra beregnermotoren via calculationResult.hasBlockingErrors', () => {
    // Scenarie: stamdata mangler → skadedato er undefined → differencekrav-beregneren
    // sætter hasBlockingErrors: true og computation: null. Snapshot-projektionen skal
    // afspejle dette korrekt via calculationResult.hasBlockingErrors-leddet.
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
        hasInvalidDraft: false,
      },
    });

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(false);
    // Faktoren (og datoen) flyder igennem snapshot → beregning (selve reduktions-matematikken er
    // dækket i eetDifferencekravCalculation-testen på et ikke-nul scenarie).
    const c = snapshot.differencekrav.computation!;
    expect(c.forligLabel).toBe('2/3');
    expect(c.forligFactor).toBe(2 / 3);
    expect(c.forligDato).toBe(toISODateString('2024-05-17'));
    expect(c.differencekrav).toBe(Math.max(0, Math.round(c.differencekravFoerForlig * (2 / 3))));
  });

  it('blokerer hele differencekrav-outputtet når både procent og brøk er udfyldt', () => {
    const snapshot = computeEetSnapshot({
      values: createValues(),
      stamdata: createStamdata(),
      fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
      forlig: {
        values: { forligAnsvarsgradProcent: 50, forligAnsvarsgradBroek: '1/3' },
        hasInvalidDraft: false,
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
        hasInvalidDraft: true,
      },
    });

    expect(snapshot.differencekrav.hasBlockingErrors).toBe(true);
    expect(snapshot.differencekrav.issues.some((issue) => issue.id === 'forlig-ansvarsgrad-invalid')).toBe(true);
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
