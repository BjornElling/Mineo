import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { buildMidlertidigtEetAfgoerelseGroupsFromImportContext } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser, type EetLoebendeComputation } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { fromKroner, toKroner } from '../../../domain/money/money';
import { buildEetImportContext, eetImportContextSchema } from '../../../domain/erhvervsevnetab/eetImportPort';
import { toISODateString } from '../../../types/branded';

const makeValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  aslAarsloen: { kind: 'number', value: 600000 },
  aslAfgoerelser: [
    {
      id: 'row-1',
      afgoerelsesDato: toISODateString('2026-02-01'),
      virkningsDato: toISODateString('2026-02-01'),
      eetPct: 15,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      fsTilbageholdtEet: 'Nej',
      tidlKapDato: undefined,
    },
    {
      id: 'row-2',
      afgoerelsesDato: toISODateString('2026-03-12'),
      virkningsDato: toISODateString('2026-03-12'),
      eetPct: 20,
      kapDato: toISODateString('2026-03-12'),
      kapPct: 5,
      afgoerelseType: 'Delvist endelig',
      fsTilbageholdtEet: 'Nej',
      tidlKapDato: undefined,
    },
    {
      id: 'row-3',
      afgoerelsesDato: toISODateString('2026-03-20'),
      virkningsDato: toISODateString('2026-03-20'),
      eetPct: 25,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Endelig',
      fsTilbageholdtEet: 'Nej',
      tidlKapDato: undefined,
    },
  ],
});

const computeGroups = (eetValues: ErhvervsevnetabComposedValues) => {
  const computation = computeEetLoebendeYdelser({
    erhvervsevnetab: eetValues,
    skadedato: toISODateString('2024-07-01'),
    skadelidteFodselsdato: eetValues.skadelidteFodselsdato,
  }).computation;

  const context = buildEetImportContext({
    revision: 'insert-rows-test',
    eetValues,
    skadedato: toISODateString('2024-07-01'),
  }, toISODateString('2026-03-19'));
  return {
    computation,
    groups: buildMidlertidigtEetAfgoerelseGroupsFromImportContext(context.groups),
  };
};

describe('buildMidlertidigtEetAfgoerelseGroupsFromImportContext', () => {
  it('bygger én EO-række per løbende ydelseslinje for midlertidige og delvist endelige afgørelser', () => {
    const eetValues = makeValues();
    const { computation, groups } = computeGroups(eetValues);
    const rows = groups.flatMap((g) => g.rows);

    expect(computation).not.toBeNull();
    const expectedPerioder = computation!.afgoerelser
      .filter((afgoerelse) => afgoerelse.afgoerelseType === 'Midlertidig' || afgoerelse.afgoerelseType === 'Delvist endelig')
      .flatMap((afgoerelse) => afgoerelse.perioder);

    expect(rows).toHaveLength(expectedPerioder.length);
    expect(rows).toEqual(
      expectedPerioder.map((periode, index) => ({
        id: rows[index]!.id,
        fraDato: periode.fra,
        tilDato: periode.til,
        ydelse: { kind: 'number', value: toKroner(periode.beregnetEetOre) },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      }))
    );
  });

  it('genererer unikke row-id på tværs af alle afgørelser og perioder (ingen duplikat ved indsættelse)', () => {
    const eetValues = makeValues();
    const { groups } = computeGroups(eetValues);
    const rows = groups.flatMap((g) => g.rows);

    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Random-id'er (createRowId) → aldrig '_empty_'-segmentet, så de kan ikke kollidere med
    // tabellens deterministiske tom-række-id'er.
    expect(ids.every((id) => !id.includes('_empty_'))).toBe(true);
  });

  it('indsætter periodetotalbeløbet uændret og ikke som et afledt dagsbeløb', () => {
    const eetValues = makeValues();
    const { computation, groups } = computeGroups(eetValues);
    const rows = groups.flatMap((g) => g.rows);

    expect(computation).not.toBeNull();
    const expectedPerioder = computation!.afgoerelser
      .filter((afgoerelse) => afgoerelse.afgoerelseType === 'Midlertidig' || afgoerelse.afgoerelseType === 'Delvist endelig')
      .flatMap((afgoerelse) => afgoerelse.perioder);

    expect(rows.map((row) => row.ydelse?.kind === 'number' ? row.ydelse.value : undefined)).toEqual(
      expectedPerioder.map((periode) => toKroner(periode.beregnetEetOre))
    );
  });

  it('importerer samme-dato-afgørelser og senere merudbetaling med deres faktiske perioder', () => {
    const values = makeValues();
    values.beregningsdato = toISODateString('2024-12-31');
    values.aslAfgoerelser = [
      {
        id: 'a',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-01-01'),
        eetPct: 20,
        kapDato: undefined,
        kapPct: undefined,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Nej',
        tidlKapDato: undefined,
      },
      {
        id: 'b',
        afgoerelsesDato: toISODateString('2024-05-01'),
        virkningsDato: toISODateString('2024-03-01'),
        eetPct: 30,
        kapDato: undefined,
        kapPct: undefined,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Nej',
        tidlKapDato: undefined,
      },
      {
        id: 'c',
        afgoerelsesDato: toISODateString('2024-08-15'),
        virkningsDato: toISODateString('2024-02-01'),
        eetPct: 25,
        kapDato: undefined,
        kapPct: undefined,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Nej',
        tidlKapDato: undefined,
      },
    ];

    const context = buildEetImportContext({
      revision: 'samme-dato-afgørelser',
      eetValues: values,
      skadedato: toISODateString('2019-04-01'),
    }, toISODateString('2024-12-31'));
    const groups = buildMidlertidigtEetAfgoerelseGroupsFromImportContext(context.groups);

    expect(context.issues.some((issue) => issue.severity === 'error')).toBe(false);
    expect(groups.map((group) => group.perioder.map((periode) => [periode.fra, periode.til]))).toEqual([
      [['2024-01-01', '2024-02-29']],
      [['2024-03-01', '2024-08-31']],
      [['2024-02-01', '2024-02-29'], ['2024-09-01', '2024-12-31']],
    ]);
  });

  it('returnerer tomt resultat når der ikke findes indsatbare perioder', () => {
    const values = makeValues();
    values.aslAfgoerelser = [
      {
        id: 'row-1',
        afgoerelsesDato: undefined,
        virkningsDato: undefined,
        eetPct: undefined,
        kapDato: undefined,
        kapPct: undefined,
        afgoerelseType: undefined,
        fsTilbageholdtEet: 'Nej',
        tidlKapDato: undefined,
      },
    ];

    const { groups } = computeGroups(values);

    expect(groups).toEqual([]);
  });

  it('failer eksplicit ved ukendt afgørelsestype i EET-computation', () => {
    const invalidComputation: EetLoebendeComputation = {
      beregningsdato: toISODateString('2026-03-19'),
      skadedato: toISODateString('2024-07-01'),
      fodselsdato: toISODateString('1980-01-01'),
      skadesaar: 2024,
      aslAarsloenAfrundet1000Ore: fromKroner(600000),
      maxAarsloenISkadesaarOre: fromKroner(600000),
      benyttetAarsloenOre: fromKroner(600000),
      grundloenNiveau: '2024',
      grundloenOre: fromKroner(600000),
      erstatningsniveauPct: 83,
      amBidragPct: 8,
      reguleringFoer2024Pct: 0,
      afgoerelser: [{
        rowId: 'row-unknown',
        afgoerelsesdato: toISODateString('2026-02-01'),
        virkningsdato: toISODateString('2026-02-01'),
        kapitaliseringsdato: null,
        skaeringsDato: null,
        harOverlap: false,
        // @ts-expect-error Testen konstruerer et umuligt engine-output for at dække invariant-bruddet.
        afgoerelseType: 'Ukendt',
        fsTilbageholdtEet: 'Nej',
        eetPct: 15,
        priorKapPct: 0,
        eetPctFoerAktuelKap: 15,
        kapPctAktuel: 0,
        kapPctKumulativ: 0,
        restEetPct: 15,
        harKapitalisering: false,
        harRestSektion: false,
        tilbagevirkendeKraft: false,
        ophoerDato: toISODateString('2026-03-19'),
        ophoerAarsag: 'beregningsdato',
        grundydelseFuldOre: fromKroner(1000),
        grundydelseRestOre: null,
        grundydelse2024FuldOre: fromKroner(1000),
        grundydelse2024RestOre: null,
        iAltBeregnetEetOre: fromKroner(1000),
        perioder: [],
      }],
    };

    expect(() => eetImportContextSchema.parse({
      revision: 'invalid-type',
      issues: [],
      groups: invalidComputation.afgoerelser.map((afgoerelse) => ({
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        eetPct: afgoerelse.eetPct,
        perioder: afgoerelse.perioder,
        afgoerelseType: afgoerelse.afgoerelseType,
      })),
    })).toThrow();
  });

  it('failer eksplicit hvis EET-computation indeholder en ikke-konverterbar periode', () => {
    const invalidComputation: EetLoebendeComputation = {
      beregningsdato: toISODateString('2026-03-19'),
      skadedato: toISODateString('2024-07-01'),
      fodselsdato: toISODateString('1980-01-01'),
      skadesaar: 2024,
      aslAarsloenAfrundet1000Ore: fromKroner(600000),
      maxAarsloenISkadesaarOre: fromKroner(600000),
      benyttetAarsloenOre: fromKroner(600000),
      grundloenNiveau: '2024',
      grundloenOre: fromKroner(600000),
      erstatningsniveauPct: 83,
      amBidragPct: 8,
      reguleringFoer2024Pct: 0,
      afgoerelser: [{
        rowId: 'row-invalid',
        afgoerelsesdato: toISODateString('2026-02-01'),
        virkningsdato: toISODateString('2026-02-01'),
        kapitaliseringsdato: null,
        skaeringsDato: null,
        harOverlap: false,
        afgoerelseType: 'Midlertidig',
        fsTilbageholdtEet: 'Nej',
        eetPct: 15,
        priorKapPct: 0,
        eetPctFoerAktuelKap: 15,
        kapPctAktuel: 0,
        kapPctKumulativ: 0,
        restEetPct: 15,
        harKapitalisering: false,
        harRestSektion: false,
        tilbagevirkendeKraft: false,
        ophoerDato: toISODateString('2026-03-19'),
        ophoerAarsag: 'beregningsdato',
        grundydelseFuldOre: fromKroner(1000),
        grundydelseRestOre: null,
        grundydelse2024FuldOre: fromKroner(1000),
        grundydelse2024RestOre: null,
        iAltBeregnetEetOre: fromKroner(1000),
        perioder: [{
          // @ts-expect-error Testen konstruerer et umuligt engine-output for at dække invariant-bruddet.
          fra: 'invalid-date',
          til: toISODateString('2026-03-19'),
          satsAar: 2026,
          maanederPraecis: 1,
          grundydelseAfrundetOre: fromKroner(1000),
          reguleringPct: 0,
          maanedligYdelseOre: fromKroner(1000),
          beregnetEetOre: fromKroner(1000),
        }],
      }],
    };

    expect(() => eetImportContextSchema.parse({
      revision: 'invalid-period',
      issues: [],
      groups: invalidComputation.afgoerelser.map((afgoerelse) => ({
        afgoerelsesdato: afgoerelse.afgoerelsesdato,
        eetPct: afgoerelse.eetPct,
        perioder: afgoerelse.perioder,
      })),
    })).toThrow();
  });
});
