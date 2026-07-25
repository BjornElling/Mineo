import {
  resolveEoBlockedDependencies,
  hasAnyBlockingEoIssue,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoDependencyGroups';
import type { EoInputIssues } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import { EO_TOP_LEVEL_ERROR_KEYS } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection';

// WI-004: enhedstests for selve afhængighedsopdelingen (§1.10). `eoEngineGate.test.ts` beviser opdelingens
// VIRKNING gennem snapshottet; her testes reglen isoleret, så en fejl i grupperne kan lokaliseres direkte.
//
// De to fejlretninger er lige alvorlige: en for smal gruppe giver falske tal bag en rød markering, og en for
// bred gruppe overblokerer og fjerner gyldige, uafhængige visninger (brugerbeslutning 2, 2026-07-25).

const redIssue = (reason: 'format' | 'bounds' | 'rule' | 'schema' | 'aggregate' = 'format'):
NonNullable<EoInputIssues[string]> => ({
  input: { message: 'Ugyldig værdi', severity: 'error', source: 'input', reason },
});

const warningIssue = (): NonNullable<EoInputIssues[string]> => ({
  input: { message: 'En advarsel', severity: 'warning', source: 'input', reason: 'rule' },
});

const NOTHING_BLOCKED = {
  svieSmerte: false,
  taf: false,
  forlig: false,
} as const;

describe('resolveEoBlockedDependencies', () => {
  it('blokerer ingen gren for et tomt issue-sæt', () => {
    expect(resolveEoBlockedDependencies({})).toEqual(NOTHING_BLOCKED);
  });

  it('blokerer ingen gren for en warning — kun `error` blokerer dependents', () => {
    // `error-contract.md` §1.1: en warning blokerer aldrig, hverken save, beregning eller dokument.
    expect(resolveEoBlockedDependencies({ svieSmerteSatserAar: warningIssue() })).toEqual(NOTHING_BLOCKED);
  });

  it('blokerer også på bounds — en gembar værdi er ikke dermed beregnbar', () => {
    const blocked = resolveEoBlockedDependencies({ svieSmerteSatserAar: redIssue('bounds') });
    expect(blocked.svieSmerte).toBe(true);
  });

  describe('grenene er indbyrdes uafhængige', () => {
    // Hver case hævder BEGGE retninger: den ramte gren blokeres, og mindst én uafhængig gren gør ikke.
    const cases: ReadonlyArray<Readonly<{
      navn: string;
      feltnoegle: string;
      forventetGren: keyof typeof NOTHING_BLOCKED;
    }>> = [
      { navn: 'svie/smerte-satsår', feltnoegle: 'svieSmerteSatserAar', forventetGren: 'svieSmerte' },
      { navn: 'svie/smerte tidligere total', feltnoegle: 'svieSmerteTidligereTotal', forventetGren: 'svieSmerte' },
      { navn: 'svie/smerte-rækkecelle', feltnoegle: 'row-9:svieSmertePerioder', forventetGren: 'svieSmerte' },
      { navn: 'tidligere modtaget TAF', feltnoegle: 'tidligereModtagetTaf', forventetGren: 'taf' },
      { navn: 'uspecificerede ferie-/fridage', feltnoegle: 'uspecificeredeFerieFridage', forventetGren: 'taf' },
      { navn: 'angivet månedsløn', feltnoegle: 'maanedsloenenUdgoer', forventetGren: 'taf' },
      { navn: 'lønindkomst-aggregat', feltnoegle: 'af-1:loenindkomst', forventetGren: 'taf' },
      { navn: 'forligs-ansvarsgrad i procent', feltnoegle: 'forligAnsvarsgradProcent', forventetGren: 'forlig' },
      { navn: 'forligs-ansvarsgrad som brøk', feltnoegle: 'forligAnsvarsgradBroek', forventetGren: 'forlig' },
    ];

    for (const { navn, feltnoegle, forventetGren } of cases) {
      it(`en rød ${navn} blokerer kun ${forventetGren}`, () => {
        const blocked = resolveEoBlockedDependencies({ [feltnoegle]: redIssue() });

        expect(blocked[forventetGren]).toBe(true);
        // Alle ANDRE grene skal være urørte — ellers er gruppen for bred (overblokering).
        for (const gren of Object.keys(NOTHING_BLOCKED) as Array<keyof typeof NOTHING_BLOCKED>) {
          if (gren === forventetGren) continue;
          expect(blocked[gren]).toBe(false);
        }
      });
    }
  });

  it('blokerer flere grene samtidigt, når flere felter er røde', () => {
    const blocked = resolveEoBlockedDependencies({
      svieSmerteSatserAar: redIssue(),
      tidligereModtagetTaf: redIssue(),
    });

    expect(blocked.svieSmerte).toBe(true);
    expect(blocked.taf).toBe(true);
    expect(blocked.forlig).toBe(false);
  });

  it('lader en ukendt feltnøgle stå uden for grenene', () => {
    // Bevidst: en ukendt nøgle må ikke gætte sig til en gren. Aggregatet fanges i stedet fail-closed af
    // `hasAnyBlockingEoIssue` nedenfor, så fejlen aldrig forsvinder lydløst ud af gatingen.
    expect(resolveEoBlockedDependencies({ etHeltUkendtFelt: redIssue() })).toEqual(NOTHING_BLOCKED);
  });
});

// COMPLETENESS: hver eneste nøgle, produktionen faktisk kan rapportere, skal høre til mindst én gren.
//
// Denne test findes, fordi den første udgave af grupperne var skrevet efter SCHEMA-feltnavne, mens `eoErrors`
// bruger et andet, mindre nøglesæt (`EO_TOP_LEVEL_ERROR_FIELDS`). Fire TAF-nøgler og begge forligs-nøgler
// ramte derfor ingen gruppe: en rød ansvarsgrad blokerede INGEN gren. En håndskrevet liste i testen ville
// have gentaget samme fejl, så testen itererer det FAKTISKE produktionskatalog.
describe('afhængighedsopdelingen dækker hele produktionens nøglesæt', () => {
  it.each(EO_TOP_LEVEL_ERROR_KEYS)('nøglen %s hører til mindst én gren', (key) => {
    const blocked = resolveEoBlockedDependencies({ [key]: redIssue() });

    expect(Object.values(blocked).some(Boolean)).toBe(true);
  });

  it('katalogets nøgler er faktisk indlæst (værn mod en tom it.each)', () => {
    // Uden dette ville en tom eksport gøre completeness-testen ovenfor til en no-op, der altid "består".
    expect(EO_TOP_LEVEL_ERROR_KEYS.length).toBeGreaterThan(5);
  });
});

describe('hasAnyBlockingEoIssue', () => {
  it('er falsk for tomt sæt og for warnings', () => {
    expect(hasAnyBlockingEoIssue({})).toBe(false);
    expect(hasAnyBlockingEoIssue({ svieSmerteSatserAar: warningIssue() })).toBe(false);
  });

  it('fanger ENHVER rød fejl — også en feltnøgle ingen gruppe genkender', () => {
    // Fail-closed-reglen for det krydsgående aggregat: en ukendt rød nøgle skal stadig blokere summen.
    expect(hasAnyBlockingEoIssue({ etHeltUkendtFelt: redIssue() })).toBe(true);
  });
});
