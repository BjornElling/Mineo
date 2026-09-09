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

// Løbende perioder og differencekrav kontrolleres med konkrete værdier frem for uigennemsigtige hashes.
// Sammenligning med HEAD ved periodeomlægningen viste uændrede beløb; den delvist endelige
// ydelses ophør/fradragesTil flyttede fra 28-02 til 31-01-2026 pga. kapitaliseringen 01-02.
// De komplette beregningsperioder erstatter samtidig den gamle ene overlap-procent.
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

  it('bevarer beløbene og viser kapitaliseringens faktiske ophør i et flerårigt forløb', () => {
    const computation = snapshot.loebendeYdelser.computation;
    if (!computation) throw new Error('Forventede løbende ydelser');
    expect(computation.afgoerelser.map(({ iAltBeregnetEetOre, ophoerDato }) => [iAltBeregnetEetOre, ophoerDato])).toEqual([
      [fromKroner(69296), iso('2025-09-30')],
      [fromKroner(35991), iso('2026-01-31')],
      [fromKroner(4158), iso('2026-01-31')],
    ]);
    expect(computation.afgoerelser[1]?.ophoerAarsag).toBe('kapitalisering');
    expect(computation.afgoerelser[1]?.perioder.at(-1)?.til).toBe(iso('2026-01-31'));
  });

  it('låser kapitalisering med delvist endelig og endelig afgørelse', () => {
    expect(goldenHash(snapshot.kapitalisering)).toBe('fef5c1aa3c40ad069710ae68800c2921c7dff1e7ab8f32bed17e1e764b413a6b');
  });

  // Hash-opdateringen 2026-09-09 er bevist frem for antaget, jf. kravet i denne fils historik: det
  // ENESTE nye i `efterEal` er forligsblokken, og `ealKravOre` – det tal differencekravet aftager – er
  // uændret. De to assertions nedenfor låser netop det, så en senere hash-opdatering ikke kan skjule,
  // at et beløb har flyttet sig.
  it('lader forliget reducere fanens EGET EAL-krav uden at røre det ureducerede grundlag', () => {
    const computation = snapshot.efterEal.computation;
    if (!computation) throw new Error('Forventede EAL-beregning');
    // Uændret af forliget: EAL-kravet efter maksimum, regulering og aldersreduktion.
    expect(computation.ealKravOre).toBe(fromKroner(1388687));
    expect(computation.forlig).toEqual({
      label: '2/3',
      dato: iso('2026-03-01'),
      // round0(1.388.687 x 2/3) – samme krone-afrunding som differencekravets forligsreduktion.
      ealKravEfterForligOre: fromKroner(925791),
    });
  });

  it('låser EAL-beregningen inklusive maksimum, regulering og aldersreduktion', () => {
    expect(goldenHash(snapshot.efterEal)).toBe('b16a1146c36150e7d56eb360015d491d2485f68aeef6556ca8dd90887860aac0');
  });

  it('fører samme perioder og beløb videre til differencekravet', () => {
    const computation = snapshot.differencekrav.computation;
    if (!computation) throw new Error('Forventede differencekrav');
    expect(computation.fradragLoebendeYdelserOre).toBe(fromKroner(4158));
    expect(computation.fradragKapitaliseretEetOre).toBe(fromKroner(2913621));
    expect(computation.ealKravOre).toBe(fromKroner(1388687));
    expect(computation.differencekravOre).toBe(fromKroner(0));
    expect(computation.afgoerelser.map(({ fradragesTil }) => fradragesTil)).toEqual([
      iso('2025-09-30'), iso('2026-01-31'), iso('2026-01-31'),
    ]);
    expect(computation.loebendeComputation?.afgoerelser.map(({ perioder }) => perioder)).toEqual(
      snapshot.loebendeYdelser.computation?.afgoerelser.map(({ perioder }) => perioder)
    );
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
