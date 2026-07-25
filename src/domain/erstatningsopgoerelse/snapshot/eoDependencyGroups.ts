import { eoIssueBlocksDependents, type EoInputIssues } from '../eoInputIssues';

// EO's afhængighedsgrupper (§1.10, WI-004). Hver gruppe er de felter, ÉN beregningsgren faktisk læser, så en
// rød feltfejl kun blokerer sin egen gren. Uden opdelingen nulstiller enhver reader-/validatorfejl hele det
// autoritative `data`-objekt — og et ugyldigt svie/smerte-satsår fjerner da også den gyldige TAF-visning
// (brugerbeslutning 2, 2026-07-25: det må den ikke).
//
// ⚠️ Listerne må IKKE udvides til "alle EO-felter". En for bred liste overblokerer, og overblokering er
// præcis lige så forkert som falske tal (§1.10). Udvid kun, når den tilhørende motor faktisk læser feltet.

/**
 * En afhængighedsgruppes felter. `exactFields` matcher feltnøglen præcist; `keyFragments` matcher som
 * delstreng, fordi de syntetiske aggregatnøgler bærer et entity-id som prefix (fx `<afId>:loenindkomst`).
 *
 * ⚠️ Nøglerne her er `eoErrors`-nøgler — IKKE schema-feltnavne og ikke feltadresser. Kilden er
 * `EO_TOP_LEVEL_ERROR_FIELDS` i `erstatningsopgoerelseReaderProjection.ts` plus det syntetiske
 * `${afId}:loenindkomst`-aggregat. Sættet er udtømmende og enumererbart; `eoDependencyGroups.test.ts`
 * hævder, at hver eneste produktionsnøgle hører til mindst én gren, så en ny nøgle ikke lydløst falder
 * uden for opdelingen.
 */
type DependencyGroup = Readonly<{
  exactFields: readonly string[];
  keyFragments: readonly string[];
}>;

/** Svie/smerte-motorens egne felter — udledt af `engines/svieSmerteEngine.ts`. */
const SVIE_SMERTE_GROUP: DependencyGroup = {
  exactFields: [
    'svieSmerteAktuelPeriode',
    'svieSmerteSatserAar',
    'svieSmerteTidligereTotal',
  ],
  keyFragments: ['svieSmertePerioder'],
};

/**
 * Tabt arbejdsfortjeneste: beregningsgrundlaget, fraværsdagene og lønindkomsten. Grenen dækker
 * `computeTafNettoBeregning` og dens underliggende SFGG-/lønudviklings-beregninger.
 *
 * `uspecificeredeFerieFridage` og `oevrigeFravaersdage` justerer TAF-dagene; `maanedsloenenUdgoer`/
 * `dagsloenenUdgoer` er beregningsgrundlaget ved "Angivet måneds-/dagsløn". Alle fire fodrer TAF-motoren.
 */
const TAF_GROUP: DependencyGroup = {
  exactFields: [
    'tidligereModtagetTaf',
    'uspecificeredeFerieFridage',
    'oevrigeFravaersdage',
    'maanedsloenenUdgoer',
    'dagsloenenUdgoer',
  ],
  // `<afId>:loenindkomst` er det syntetiske aggregat for en ansættelsesforholds ugyldige StandardLøn-/
  // manuel-regulerings-celler. Lønudviklingen er en del af TAF-beregningen, ikke en selvstændig gren.
  keyFragments: ['loenindkomst', 'tafPerioder'],
};

/**
 * Forliget skalerer de samlede krav. En ugyldig ansvarsgrad må ALDRIG omfortolkes som "intet forlig":
 * readeren maskerer den til `undefined`, og motoren ville da regne med 100 %.
 */
const FORLIG_GROUP: DependencyGroup = {
  exactFields: ['forligAnsvarsgradProcent', 'forligAnsvarsgradBroek', 'forligDato'],
  keyFragments: [],
};

const groupMatches = (group: DependencyGroup, fieldKey: string): boolean =>
  group.exactFields.includes(fieldKey)
  || group.keyFragments.some((fragment) => fieldKey.includes(fragment));

const hasBlockingIssueInGroup = (issues: EoInputIssues, group: DependencyGroup): boolean =>
  Object.entries(issues).some(([fieldKey, bySource]) =>
    bySource !== undefined
    && groupMatches(group, fieldKey)
    && Object.values(bySource).some(eoIssueBlocksDependents));

/**
 * Hvilke af EO's uafhængige grene er blokeret af en rød reader-feltfejl?
 *
 * Resultatet er rent afledt af issue-sættet — der lagres ingen parallel klassifikations-sidekanal ved siden
 * af snapshottets egne invarianter (WI-004-invariant).
 */
export type EoBlockedDependencies = Readonly<{
  svieSmerte: boolean;
  taf: boolean;
  forlig: boolean;
}>;

/**
 * Grenene svarer PRÆCIST til de afhængigheder, `eoErrors` faktisk kan rapportere — hverken flere eller færre.
 *
 * ⚠️ Der er BEVIDST ingen `regulering`- eller `oevrigeKrav`-gren:
 * - Reguleringsforløbet har ingen egen nøgle; en ugyldig manuel reguleringscelle rapporteres som
 *   `<afId>:loenindkomst`-aggregatet, altså gennem TAF-grenen.
 * - Øvrige krav-cellerne når slet ikke `eoErrors`; de evalueres i rækkeevalueringen (`EO_ROW_BUILDERS`), som
 *   har sin egen gate mod download.
 *
 * En gren, der aldrig kan udløses, ville foregøgle en præcision, der ikke findes, og gøre det uklart hvor
 * blokeringen egentlig afgøres. Får en af dem sin egen nøgle, tilføjes grenen her — completeness-testen
 * fanger en ny nøgle, der ellers ville falde uden for opdelingen.
 */
export const resolveEoBlockedDependencies = (issues: EoInputIssues): EoBlockedDependencies => Object.freeze({
  svieSmerte: hasBlockingIssueInGroup(issues, SVIE_SMERTE_GROUP),
  taf: hasBlockingIssueInGroup(issues, TAF_GROUP),
  forlig: hasBlockingIssueInGroup(issues, FORLIG_GROUP),
});

/**
 * Er en gren blokeret, når ALLE reader-fejl tælles med — også dem, ingen gruppe genkender?
 *
 * Fail-closed-reglen for aggregatet: en ukendt feltnøgle med rød fejl må ikke lydløst forsvinde ud af
 * gatingen. Aggregatet (samlet total, canonicalOutput, pdfModel) er derfor blokeret ved ENHVER rød
 * reader-fejl, mens de enkelte grene kun blokeres af deres egne felter.
 */
export const hasAnyBlockingEoIssue = (issues: EoInputIssues): boolean =>
  Object.values(issues).some((bySource) =>
    bySource !== undefined && Object.values(bySource).some(eoIssueBlocksDependents));
