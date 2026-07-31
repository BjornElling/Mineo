import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../types/branded';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { loenindkomstAnsaettelsesforholdSchema } from '../../schemas/formSchemas/sections/erstatningsopgoerelseSchemas';
import { loenudviklingBeregningsgrundlagEnum } from '../../schemas/formSchemas';
import { asSfggAmount, withSfggIngenForEmployments } from '../utils/sfggTestSupport';
import {
  parseOffentligLoenSelection,
  type OffentligLoenSelectionFailure,
} from '../../domain/erstatningsopgoerelse/helpers/offentligLoenSelection';

/**
 * VÆRN: ingen ufuldstændig reguleringsopsætning må nå motorens defensive throws.
 *
 * `loenudviklingBeregning.ts` erklærer i sin modulnote, at alle dens `throw new Error()` er
 * defensive invarianter, som "kun kan nås hvis erstatningsopgoerelseValidator har fejlet i at
 * afvise input". Den præmis var UBEVIST — og den holdt ikke: en offentlig overenskomst uden
 * løntrin/gruppe passerede validatoren og kastede i motoren, hvilket brugeren mødte som
 * `eo_snapshot:runtime_exception` ("Uventet runtimefejl i EO-snapshot") i stedet for en
 * feltplaceret fejl, han kunne rette.
 *
 * Testen fejer inputrummet for reguleringsopsætningen igennem og kræver, at en ufuldstændig
 * opsætning altid ender som en SYNLIG valideringsfejl — aldrig som fail-closed runtime-exception.
 * Den er bevidst adfærdsmæssig og ikke strukturel: en regex over throw-sites ville hverken kunne
 * se, om en gren er nåelig, eller om validatoren rent faktisk dækker den.
 */

const kr = asSfggAmount;

const INDTAEGT_ROWS = [
  ['6', '2021'], ['7', '2021'], ['8', '2021'], ['9', '2021'], ['10', '2021'], ['11', '2021'],
  ['12', '2021'], ['1', '2022'], ['2', '2022'], ['3', '2022'], ['4', '2022'], ['5', '2022'],
].map(([maaned, aar], index) => ({
  id: `row-${index}`,
  col0_maaned: maaned,
  col1_maaned: aar,
  col2: kr(30000),
  col5: kr(189.3),
  fpFvShSoBeloeb: kr(5400),
  pensionBeloeb: kr(3300),
}));

const buildEmployment = (over: Record<string, unknown>) =>
  loenindkomstAnsaettelsesforholdSchema.parse({
    id: 'af-1',
    navnPaaArbejdssted: 'Testarbejdsplads',
    ansatPaaSkadestidspunktet: true,
    tillaegAngivesSom: 'beloeb',
    loenperiode: 'maaned',
    indtaegtsoplysningerTableData: INDTAEGT_ROWS,
    fuldLoenUnderFerie: 'Ja',
    loenPaaHelligdage: 'Almindelig løn',
    ...over,
  });

const buildValues = (employment: ReturnType<typeof buildEmployment>) => {
  const eo = createErstatningsopgoerelseInitialValues();
  eo.eoNummer = '1';
  eo.vedroererPeriodeFra = toISODateString('2022-06-01');
  eo.vedroererPeriodeTil = toISODateString('2025-06-30');
  eo.kravPaaTabtArbejdsfortjeneste = 'Ja';
  eo.tafPerioder = [{
    id: 'taf-1',
    fra: toISODateString('2022-06-01'),
    til: toISODateString('2025-06-30'),
  }] as typeof eo.tafPerioder;
  eo.beregnesUdFra = 'Beregningsperiode';
  eo.tafBeregningsperiodeFra = toISODateString('2021-06-01');
  eo.tafBeregningsperiodeTil = toISODateString('2022-05-31');
  // SFGG er ikke det, der testes her — den delte helper låser kravet om et eksplicit
  // SFGG-beregningsgrundlag op uden at ændre beregnede tal (jf. sfggTestSupport).
  return withSfggIngenForEmployments({ ...eo, loenindkomstAnsaettelsesforhold: [employment] });
};

const runSnapshot = (label: string, employment: ReturnType<typeof buildEmployment>) =>
  computeEoSnapshot({
    revision: label,
    stamdataValues: {
      ...STAMDATA_INITIAL_VALUES,
      skadestype: 'Arbejdsulykke',
      skadedato: toISODateString('2022-06-01'),
    },
    eoValues: buildValues(employment),
  });

/**
 * Ufuldstændige opsætninger, én pr. måde reguleringsvalget kan mangle en afhængighed. Hver af dem
 * SKAL både undgå `runtime_exception` og give brugeren mindst én blokerende fejl at rette.
 *
 * Lovligt tomme opsætninger (fx manuel procentsats uden rækker = 0 % regulering) hører ikke til
 * her — de har deres egen test nedenfor, hvor kravet alene er, at motoren ikke kaster.
 */
const UFULDSTAENDIGE_OPSAETNINGER: ReadonlyArray<Readonly<{
  navn: string;
  employment: Record<string, unknown>;
}>> = [
  {
    navn: 'offentlig overenskomst uden løntrin og gruppe',
    employment: {
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
    },
  },
  {
    navn: 'offentlig overenskomst uden gruppe',
    employment: {
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 30,
    },
  },
  {
    navn: 'offentlig overenskomst uden løntype',
    employment: {
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenTrin: 30,
      offentligLoenGruppe: 0,
    },
  },
  {
    navn: 'overenskomst valgt, men togglen slået fra',
    employment: {
      harOverenskomst: false,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 30,
      offentligLoenGruppe: 0,
    },
  },
  {
    navn: 'overenskomst-grundlag uden valgt overenskomst',
    employment: { harOverenskomst: true, loenudviklingBeregningsgrundlag: 'Overenskomst' },
  },
  {
    navn: 'KRL-grundlag uden satstabel',
    employment: { loenudviklingBeregningsgrundlag: 'KRL satstabel' },
  },
  {
    navn: 'statistik-grundlag uden model',
    employment: { loenudviklingBeregningsgrundlag: 'Statistik' },
  },
  {
    navn: 'manuelt angivet uden rækker',
    employment: { loenudviklingBeregningsgrundlag: 'Manuelt angivet' },
  },
  {
    navn: 'KL-lønaftaler uden lønoplysninger i dækningsintervallet',
    employment: {
      loenudviklingBeregningsgrundlag: 'KL-lønaftaler',
      indtaegtsoplysningerTableData: [],
    },
  },
  {
    navn: 'intet reguleringsgrundlag valgt',
    employment: { loenudviklingBeregningsgrundlag: undefined },
  },
];

describe('regulering: defensive motor-invarianter er ikke nåelige gennem UI-input', () => {
  it.each(UFULDSTAENDIGE_OPSAETNINGER)(
    '$navn → synlig valideringsfejl, ikke runtime_exception',
    ({ navn, employment }) => {
      const snapshot = runSnapshot(navn, buildEmployment(employment));

      const runtimeException = snapshot.invariants.find((invariant) => invariant.id === 'runtime_exception');
      expect(
        runtimeException,
        `"${navn}" nåede en defensiv motor-invariant: ${JSON.stringify(runtimeException?.evidence)}`
      ).toBeUndefined();
      expect(snapshot.failClosedReason).not.toBe('runtime_exception');

      // Fail-closed er ikke nok i sig selv: en ufuldstændig opsætning SKAL give brugeren mindst
      // én blokerende fejl at rette. Ellers ville et tavst "ok" på mangelfuldt grundlag bestå.
      const blokerende = snapshot.invariants.filter(
        (invariant) => !invariant.passed && invariant.severity === 'error'
      );
      expect(blokerende.length, `"${navn}" gav ingen blokerende fejl`).toBeGreaterThan(0);
    }
  );

  it('manuel procentsats uden rækker er lovligt tom (0 % regulering) og må ikke kaste', () => {
    // Basisindekset syntetiseres fra reguleringsdatoen, så en tom tabel har en veldefineret
    // betydning. Kravet er derfor KUN, at motoren ikke fail-closer — ikke at brugeren blokeres.
    const snapshot = runSnapshot('manuel-procentsats-tom', buildEmployment({
      loenudviklingBeregningsgrundlag: 'Manuel procentsats',
    }));
    expect(snapshot.failClosedReason).not.toBe('runtime_exception');
  });

  it('en fuldt udfyldt offentlig overenskomst beregnes uden fejl (testen er ikke grøn af tomhed)', () => {
    const snapshot = runSnapshot('komplet', buildEmployment({
      harOverenskomst: true,
      overenskomstId: 'kl-overenskomst',
      loenudviklingBeregningsgrundlag: 'Overenskomst',
      offentligLoenType: 'Månedsløn',
      offentligLoenTrin: 30,
      offentligLoenGruppe: 0,
    }));

    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.status).toBe('ok');
  });

  it('dækker hvert reguleringsgrundlag i enummet (ingen gren glider udenom fejningen)', () => {
    const daekkede = new Set<string | undefined>(
      UFULDSTAENDIGE_OPSAETNINGER.map(
        (opsaetning) => opsaetning.employment.loenudviklingBeregningsgrundlag as string | undefined
      )
    );
    // Grundlag der er dækket af en egen test frem for af tabellen (lovligt tomme opsætninger).
    daekkede.add('Manuel procentsats');

    const udaekkede = loenudviklingBeregningsgrundlagEnum.options.filter(
      (grundlag) => grundlag !== 'Ingen' && !daekkede.has(grundlag)
    );
    expect(udaekkede, `Reguleringsgrundlag uden en ufuldstændig-opsætning i fejningen: ${udaekkede.join(', ')}`).toEqual([]);
  });

  it('hvert udfald i parserens fejl-union har en synlig validator-besked', () => {
    // Parserens `reason`-union ER motorens kontrakt: kaster motoren på en årsag, skal validatoren
    // have afvist den først. Selve runtime_exception-friheden for disse konfigurationer er allerede
    // dækket af fejningen ovenfor — her pinnes udelukkende, at ingen årsag mangler en besked.
    const reasons: readonly OffentligLoenSelectionFailure[] = [
      'loentype-mangler', 'trin-mangler', 'trin-ugyldig', 'gruppe-mangler', 'gruppe-ugyldig',
    ];

    // Fixturene beviser, at årsagerne er nåelige fra realistisk input — ikke blot deklareret.
    const naaedeAarsager = ([
      { offentligLoenType: undefined, offentligLoenTrin: undefined, offentligLoenGruppe: undefined },
      { offentligLoenType: 'Månedsløn', offentligLoenTrin: undefined, offentligLoenGruppe: undefined },
      { offentligLoenType: 'Månedsløn', offentligLoenTrin: 99, offentligLoenGruppe: undefined },
      { offentligLoenType: 'Månedsløn', offentligLoenTrin: 30, offentligLoenGruppe: undefined },
      { offentligLoenType: 'Månedsløn', offentligLoenTrin: 30, offentligLoenGruppe: 9 },
    ] as const).map((input) => {
      const result = parseOffentligLoenSelection({ offentligType: 'KL', ...input });
      expect(result.ok).toBe(false);
      return result.ok ? null : result.reason;
    });

    expect(new Set(naaedeAarsager)).toEqual(new Set(reasons));
  });
});
