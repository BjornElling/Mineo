import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { buildMidlertidigtEetAfgoerelseGroupsFromComputation } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser, type EetLoebendeComputation } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
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

  return {
    computation,
    groups: buildMidlertidigtEetAfgoerelseGroupsFromComputation(computation),
  };
};

describe('buildMidlertidigtEetAfgoerelseGroupsFromComputation', () => {
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
        ydelse: { kind: 'number', value: periode.beregnetEet },
        tillaeg: undefined,
        ydelsestype: 'midlertidigt_eet',
      }))
    );
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
      expectedPerioder.map((periode) => periode.beregnetEet)
    );
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
      aslAarsloenAfrundet1000: 600000,
      maxAarsloenISkadesaar: 600000,
      benyttetAarsloen: 600000,
      grundloenNiveau: '2024',
      grundloen: 600000,
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
        grundydelseFuld: 1000,
        grundydelseRest: null,
        grundydelse2024Fuld: 1000,
        grundydelse2024Rest: null,
        iAltBeregnetEet: 1000,
        perioder: [],
      }],
    };

    expect(() => buildMidlertidigtEetAfgoerelseGroupsFromComputation(invalidComputation))
      .toThrow('CRITICAL: Ukendt EET-afgørelsestype i midlertidigt EET-import.');
  });

  it('failer eksplicit hvis EET-computation indeholder en ikke-konverterbar periode', () => {
    const invalidComputation: EetLoebendeComputation = {
      beregningsdato: toISODateString('2026-03-19'),
      skadedato: toISODateString('2024-07-01'),
      fodselsdato: toISODateString('1980-01-01'),
      skadesaar: 2024,
      aslAarsloenAfrundet1000: 600000,
      maxAarsloenISkadesaar: 600000,
      benyttetAarsloen: 600000,
      grundloenNiveau: '2024',
      grundloen: 600000,
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
        grundydelseFuld: 1000,
        grundydelseRest: null,
        grundydelse2024Fuld: 1000,
        grundydelse2024Rest: null,
        iAltBeregnetEet: 1000,
        perioder: [{
          // @ts-expect-error Testen konstruerer et umuligt engine-output for at dække invariant-bruddet.
          fra: 'invalid-date',
          til: toISODateString('2026-03-19'),
          satsAar: 2026,
          maanederPraecis: 1,
          grundydelseAfrundet: 1000,
          reguleringPct: 0,
          maanedligYdelse: 1000,
          beregnetEet: 1000,
        }],
      }],
    };

    expect(() => buildMidlertidigtEetAfgoerelseGroupsFromComputation(invalidComputation))
      .toThrow('CRITICAL: Kunne ikke konvertere midlertidigt EET-periode til ISO EO-række.');
  });
});
