import { createHash } from 'node:crypto';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { computeEetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import { computeMerErstatningPensionsalder } from '../../../domain/erhvervsevnetab/eetMerErstatningPensionsalderCalculation';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { ceilNearest12, round0, round2, round3, round4, roundNearest1000 } from '../../../utils/roundingShortcuts';
import { toISODateString } from '../../../types/branded';
import { fromKroner } from '../../../domain/money/money';

const iso = (value: string) => toISODateString(value);

const sortRecursively = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value === null || typeof value !== 'object') return value;

  const normalizedEntries = Object.entries(value as Readonly<Record<string, unknown>>)
    .map(([key, entry]) => {
      // Golden-nettet sammenligner semantiske kroner. Efter migrationen skal et MoneyOre-felt
      // derfor lande på samme nøgle og værdi som det nuværende kronefelt.
      if (key.endsWith('Ore')) {
        return [key.slice(0, -3), typeof entry === 'number' ? entry / 100 : entry] as const;
      }
      return [key, entry] as const;
    });

  return Object.fromEntries(
    normalizedEntries
      // Kode-enheds-ordning (ikke localeCompare): golden-hashen skal være byte-identisk på tværs
      // af platforme. localeCompare afhænger af værtens ICU/locale, så en hash genereret på Windows
      // matchede ikke CI's Linux-ICU. Ren < / >-sammenligning er locale-uafhængig og deterministisk.
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, sortRecursively(entry)])
  );
};

const goldenHash = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(sortRecursively(value))).digest('hex');

const createValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: iso('2026-03-19'),
  skadelidteFodselsdato: iso('1980-01-01'),
  koen: 'Kvinde',
  aslAarsloen: { kind: 'number', value: 600000 },
  ealAarsloen: { kind: 'number', value: 600000 },
  ealEetPct: 25,
  aslAfgoerelser: [
    {
      id: 'midlertidig-1',
      afgoerelsesDato: iso('2025-01-15'),
      virkningsDato: iso('2024-10-01'),
      eetPct: 15,
      kapDato: undefined,
      kapPct: undefined,
      afgoerelseType: 'Midlertidig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
    {
      id: 'delvist-endelig-1',
      afgoerelsesDato: iso('2025-09-15'),
      virkningsDato: iso('2025-07-01'),
      eetPct: 25,
      kapDato: iso('2025-09-15'),
      kapPct: 10,
      afgoerelseType: 'Delvist endelig',
      tidlKapDato: undefined,
      fsTilbageholdtEet: 'Nej',
    },
    {
      id: 'endelig-1',
      afgoerelsesDato: iso('2026-02-01'),
      virkningsDato: iso('2026-01-01'),
      eetPct: 35,
      kapDato: iso('2026-02-01'),
      kapPct: 25,
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
  skadelidte: 'Golden',
  skadestype: 'Arbejdsulykke',
  skadedato: iso('2024-07-01'),
  skadelidteFodselsdato: iso('1980-01-01'),
});

describe('EET MoneyOre-migration karakterisering', () => {
  const snapshot = computeEetSnapshot({
    values: createValues(),
    stamdata: createStamdata(),
    fieldErrors: { stamdata: {}, erhvervsevnetab: {}, faellesAarsloen: {} },
    forlig: {
      values: { forligAnsvarsgradProcent: undefined, forligAnsvarsgradBroek: '2/3' },
      dato: iso('2026-03-01'),
      hasRejectedInput: false,
    },
  });

  it('låser hele det samlede snapshot byte-præcist efter stabil nøglesortering', () => {
    expect(goldenHash(snapshot)).toBe('2d7ac9037ed02d1fbfa2fb2b98423db9f0279449ed83d96d7fc35e2a59f59cbc');
  });

  it('låser løbende ydelser med overlap og kalenderårsskift', () => {
    expect(goldenHash(snapshot.loebendeYdelser)).toBe('c541115b3e69339f7d2e3fa2b8a495cfc073e01865109e474822321a308cfe1c');
  });

  it('låser kapitalisering med delvist endelig og endelig afgørelse', () => {
    expect(goldenHash(snapshot.kapitalisering)).toBe('8a0f4f882809e7c40e612dcb39971a2e57319424cf8d96558c442ae71e4479bb');
  });

  it('låser EAL-beregningen inklusive maksimum, regulering og aldersreduktion', () => {
    expect(goldenHash(snapshot.efterEal)).toBe('7426a54298f8af7237eecffa75d99609f3113f909690d1ed5a654fd96924aa79');
  });

  it('låser differencekravet inklusive søsterberegninger og forlig', () => {
    expect(goldenHash(snapshot.differencekrav)).toBe('a866b0c49cddff84b067f70b43d8dd720ae1bbaae2b4da1969f15dadc95c6262');
  });

  it('låser mer-erstatning ved forhøjet pensionsalder med alle delresultater', () => {
    const issues: Array<{ id: string; severity: 'error' | 'warning'; message: string }> = [];
    const computation = computeMerErstatningPensionsalder({
      kapitaliseringer: [{
        rowId: 'kap-2014',
        afgoerelsesdato: iso('2014-06-01'),
        kapitaliseringsdato: iso('2014-06-01'),
        kapitaliseringspct: 25,
        grundloenOre: fromKroner(216019),
        erstatningsniveauPct: 83,
        amBidragPct: 8,
      }],
      beregningsdato: iso('2016-06-01'),
      skadedato: iso('2011-01-01'),
      fodselsdato: iso('1974-02-28'),
      before2024Skade: true,
      koen: undefined,
    }, issues);

    expect(goldenHash({ computation, issues })).toBe('7e16b3284a68de6a10e5716915949db6b7a18193ccfda61a0b9bd56b16fea52b');
  });

  it('låser alle EET-afrundingsgrænser som MoneyOre-migrationen skal bevare', () => {
    expect({
      round0Under: round0(100.499999),
      round0Tie: round0(100.5),
      round2Under: round2(100.004999),
      round2Tie: round2(100.005),
      round3Tie: round3(1.2345),
      round4Tie: round4(1.23445),
      nearest1000Under: roundNearest1000(100499.999),
      nearest1000Tie: roundNearest1000(100500),
      ceil12Exact: ceilNearest12(120),
      ceil12Over: ceilNearest12(120.000001),
    }).toEqual({
      round0Under: 100,
      round0Tie: 101,
      round2Under: 100,
      round2Tie: 100.01,
      round3Tie: 1.235,
      round4Tie: 1.2345,
      nearest1000Under: 100000,
      nearest1000Tie: 101000,
      ceil12Exact: 120,
      ceil12Over: 132,
    });
  });
});
