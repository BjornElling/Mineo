import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { buildMidlertidigtEetAfgoerelseGroupsFromComputation } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { computeEetLoebendeYdelser, type EetLoebendeComputation } from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';

const makeValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: '2026-03-19',
  skadelidteFodselsdato: '1980-01-01',
  aslAarsloen: { kind: 'number', value: 600000 },
  aslAfgoerelser: [
    {
      id: 'row-1',
      afgoerelsesDato: '01-02-2026',
      virkningsDato: '01-02-2026',
      eetPct: '15',
      kapDato: '',
      kapPct: '',
      afgoerelseType: 'Midlertidig',
      tidlKapDato: '',
    },
    {
      id: 'row-2',
      afgoerelsesDato: '12-03-2026',
      virkningsDato: '12-03-2026',
      eetPct: '20',
      kapDato: '12-03-2026',
      kapPct: '5',
      afgoerelseType: 'Delvist endelig',
      tidlKapDato: '',
    },
    {
      id: 'row-3',
      afgoerelsesDato: '20-03-2026',
      virkningsDato: '20-03-2026',
      eetPct: '25',
      kapDato: '',
      kapPct: '',
      afgoerelseType: 'Endelig',
      tidlKapDato: '',
    },
  ],
});

const computeGroups = (eetValues: ErhvervsevnetabComposedValues) => {
  const computation = computeEetLoebendeYdelser({
    erhvervsevnetab: eetValues,
    skadedato: '2024-07-01',
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
        afgoerelsesDato: '',
        virkningsDato: '',
        eetPct: '',
        kapDato: '',
        kapPct: '',
        afgoerelseType: undefined,
        tidlKapDato: '',
      },
    ];

    const { groups } = computeGroups(values);

    expect(groups).toEqual([]);
  });

  it('failer eksplicit ved ukendt afgørelsestype i EET-computation', () => {
    const invalidComputation: EetLoebendeComputation = {
      beregningsdato: '2026-03-19',
      skadedato: '2024-07-01',
      fodselsdato: '1980-01-01',
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
        afgoerelsesdato: '2026-02-01',
        virkningsdato: '2026-02-01',
        kapitaliseringsdato: null,
        skaeringsDato: null,
        harOverlap: false,
        // @ts-expect-error Testen konstruerer et umuligt engine-output for at dække invariant-bruddet.
        afgoerelseType: 'Ukendt',
        eetPct: 15,
        priorKapPct: 0,
        eetPctFoerAktuelKap: 15,
        kapPctAktuel: 0,
        kapPctKumulativ: 0,
        restEetPct: 15,
        harKapitalisering: false,
        harRestSektion: false,
        tilbagevirkendeKraft: false,
        ophoerDato: '2026-03-19',
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
      beregningsdato: '2026-03-19',
      skadedato: '2024-07-01',
      fodselsdato: '1980-01-01',
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
        afgoerelsesdato: '2026-02-01',
        virkningsdato: '2026-02-01',
        kapitaliseringsdato: null,
        skaeringsDato: null,
        harOverlap: false,
        afgoerelseType: 'Midlertidig',
        eetPct: 15,
        priorKapPct: 0,
        eetPctFoerAktuelKap: 15,
        kapPctAktuel: 0,
        kapPctKumulativ: 0,
        restEetPct: 15,
        harKapitalisering: false,
        harRestSektion: false,
        tilbagevirkendeKraft: false,
        ophoerDato: '2026-03-19',
        ophoerAarsag: 'beregningsdato',
        grundydelseFuld: 1000,
        grundydelseRest: null,
        grundydelse2024Fuld: 1000,
        grundydelse2024Rest: null,
        iAltBeregnetEet: 1000,
        perioder: [{
          // @ts-expect-error Testen konstruerer et umuligt engine-output for at dække invariant-bruddet.
          fra: 'invalid-date',
          til: '2026-03-19',
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
