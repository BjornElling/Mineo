import type { FieldIssue } from '../../../inputCore/inputIssue';

// EO's afhængighedsgrupper (§1.10, WI-004). Hver gruppe er de felter, ÉN beregningsgren faktisk læser, så en
// rød feltfejl kun blokerer sin egen gren. Uden opdelingen nulstiller enhver reader-/validatorfejl hele det
// autoritative `data`-objekt — og et ugyldigt svie/smerte-satsår fjerner da også den gyldige TAF-visning
// (brugerbeslutning 2, 2026-07-25: det må den ikke).
//
// ⚠️ Listerne må IKKE udvides til "alle EO-felter". En for bred liste overblokerer, og overblokering er
// præcis lige så forkert som falske tal (§1.10). Udvid kun, når den tilhørende motor faktisk læser feltet.
//
// ── AUTORITETEN ER DET STRUKTURELLE `FieldIssueSnapshot` (Codex sol/high, WI-004 runde 4) ─────────────────
// Grupperne matchede tidligere `eoErrors`-nøgler. Det var et reelt hul: `eoErrors` indeholder KUN 11
// top-level feltnavne plus det syntetiske `${afId}:loenindkomst`-aggregat, mens de røde RÆKKE-celler
// (svie/smerte-perioder, TAF-perioder, ferie-/fraværsperioder) maskeres til tomværdi af readerens
// `readOrEmpty` uden nogensinde at nå `eoErrors`. Gruppernes rækkefragmenter kunne derfor aldrig matche
// noget, og S/S-motoren + `buildTafRanges` blev kaldt på maskerede rækkedata.
//
// Vi matcher derfor på issue-adressens STRUKTUR — descriptor-id for top-level-felter og
// `address.path`'s collection-segment for rækkeceller. Ingen `includes`/suffix-heuristik og ingen nye
// syntetiske nøgler: en ny celle i en allerede klassificeret collection er automatisk dækket, fordi
// klassifikationen sker på collection-niveau.

/** En gren blokeres af: disse eksakte felt-descriptor-id'er, eller enhver celle i disse collections. */
type DependencyGroup = Readonly<{
  /** Eksakte `FieldDescriptor.id`-værdier for top-level-felter (fx `eo.svieSmerteSatserAar`). */
  fieldIds: readonly string[];
  /** Collection-navne, hvis rækkeceller ALLE fodrer grenen (fx `svieSmertePerioder`). */
  collections: readonly string[];
}>;

/**
 * EO-perioden. Læses af BEGGE motorgrene: `buildTafRanges` klipper TAF-perioderne mod den
 * (`resolveTafEoPeriodeBounds`), og `computeSvieSmerteEngine` klipper svie/smerte-perioderne mod den.
 * Den hører derfor i BÅDE S/S- og TAF-gruppen — en delt afhængighed, ikke en overblokering.
 */
const EO_PERIODE_FIELD_IDS: readonly string[] = [
  'eo.vedroererPeriodeFra',
  'eo.vedroererPeriodeTil',
];

/**
 * Svie/smerte-motorens GRUNDLAG — udledt af `engines/svieSmerteEngine.ts`.
 *
 * ⚠️ Forligsfelterne hører IKKE hertil, selv om motoren læser dem: de gater kun efter-forlig-resultatet
 * (`svieSmerteForlig` nedenfor). En rød forligsprocent må ikke fjerne før-forlig-satserne, jf.
 * brugerbeslutning 1 (2026-07-25): "før-forlig-resultater består".
 */
const SVIE_SMERTE_GROUP: DependencyGroup = {
  fieldIds: [
    'eo.svieSmerteAktuelPeriode',
    'eo.svieSmerteSatserAar',
    'eo.svieSmerteTidligereTotal',
    'eo.svieSmerteDelvisSygemeldingSats',
    'eo.kravPaaSvieSmerteGodtgoerelse',
    'eo.tidligereSsMax',
    // CLAMPING-grænserne (`resolveSvieSmerteFejlgivendeBounds`): EO-perioden OG mén-afgørelsesdatoen klipper
    // S/S-perioderne. Maskeres en rød dato til `undefined`, forsvinder klipningen, og motoren tæller sygedage
    // UDEN for grænsen — et falsk dagantal bag en rød markering. Toggle-felterne er med, fordi de afgør, om
    // mén-datoen overhovedet er en aktiv grænse.
    ...EO_PERIODE_FIELD_IDS,
    'eo.menAfgoerelseDato',
    'eo.varigeMenAfgorelse',
    'eo.verserendeKlageMen',
  ],
  collections: ['svieSmertePerioder'],
};

/**
 * Forligsskaleringen. Motoren skalerer dagssats, maksimum og total med faktoren
 * (`svieSmerteEngine.ts:251-254`), og `buildEoComputedTotals` skalerer TAF + øvrige krav med den samme.
 *
 * En ugyldig ansvarsgrad må ALDRIG omfortolkes som "intet forlig": readeren maskerer den til `undefined`,
 * og motoren ville da regne med 100 %.
 */
const FORLIG_GROUP: DependencyGroup = {
  fieldIds: [
    'eo.forligAnsvarsgradProcent',
    'eo.forligAnsvarsgradBroek',
    'eo.forligDato',
  ],
  collections: [],
};

/**
 * Tabt arbejdsfortjeneste: beregningsgrundlaget, fraværsdagene og lønindkomsten. Grenen dækker
 * `computeTafNettoBeregning` og dens underliggende SFGG-/lønudviklings-beregninger, samt periodiseringen
 * `buildTafRanges`.
 *
 * `uspecificeredeFerieFridage` og `oevrigeFravaersdage` justerer TAF-dagene; `maanedsloenenUdgoer`/
 * `dagsloenenUdgoer` er beregningsgrundlaget ved "Angivet måneds-/dagsløn". Alle fire fodrer TAF-motoren.
 *
 * Rækkesamlingerne: `tafPerioder` er selve periodiseringen (inkl. `loseFeriedage`, der justerer dagene),
 * `ferieperioder`/`fravaerPerioder` trækker dage ud af den, `sfggAnsaettelsesforhold` bærer
 * sygeferiegodtgørelsen, og `offentligeYdelserRows` modregnes i nettotabet. Lønindkomstens egne celler
 * (StandardLøn + manuel regulering) bor i EO-løn-sektionen og dækkes af `LOENINDKOMST_COLLECTIONS`.
 */
const TAF_GROUP: DependencyGroup = {
  fieldIds: [
    'eo.tidligereModtagetTaf',
    'eo.uspecificeredeFerieFridage',
    'eo.oevrigeFravaersdage',
    'eo.maanedsloenenUdgoer',
    'eo.dagsloenenUdgoer',
    'eo.tafBeregningsperiodeFra',
    'eo.tafBeregningsperiodeTil',
    // Periodiseringens CLAMPING-grænser (`buildTafRanges` → `resolveTafFejlgivendeBounds` +
    // `resolveTafEoPeriodeBounds`). En rød dato maskeres til `undefined`, hvorved grænsen forsvinder og
    // periodiseringen bliver UKLAMPET — et forkert forløb vist som gyldigt. Toggle-felterne er med, fordi de
    // afgør, om den tilhørende dato overhovedet er en aktiv grænse.
    ...EO_PERIODE_FIELD_IDS,
    'eo.differencekravDato',
    'eo.midlertidigtEETAfgorelse',
    'eo.midlertidigEETAfgoerelseDato',
    'eo.midlertidigEETVirkningsdato',
    'eo.endeligtEETAfgorelse',
    'eo.endeligEETAfgoerelseDato',
    'eo.endeligEETVirkningsdato',
    'eo.verserendeKlageEet',
  ],
  collections: [
    'tafPerioder',
    'ferieperioder',
    'fravaerPerioder',
    'sfggAnsaettelsesforhold',
    'offentligeYdelserRows',
  ],
};

/**
 * Lønindkomstens rækkesamlinger (EO-løn-sektionen). De fodrer lønudviklingen, som er en del af
 * TAF-beregningen — ikke en selvstændig gren. Både ansættelsesforholdenes egne tabeller og de nestede
 * tabeller under `eoAngivetLoenLoenudvikling` bruger de samme collection-navne, og begge fodrer TAF.
 */
const LOENINDKOMST_COLLECTIONS: readonly string[] = [
  'loenindkomstAnsaettelsesforhold',
  'indtaegtsoplysningerTableData',
  'loenudviklingManuelTableData',
  'loenudviklingManuelProcentsatsTableData',
];

/** Alle collections, hvis celler fodrer TAF-grenen — top-level + lønindkomstens nestede tabeller. */
const TAF_COLLECTIONS: readonly string[] = [...TAF_GROUP.collections, ...LOENINDKOMST_COLLECTIONS];

/**
 * Øvrige krav-cellerne har deres EGEN gate i rækkeevalueringen (`EO_ROW_BUILDERS` +
 * `eoDocumentDownloadGate`) og indgår ikke i S/S- eller TAF-grenen. De blokerer derimod aggregatet, fordi
 * `buildOevrigeKravModel` summerer dem ind i `samletTotalOre`.
 */
const OEVRIGE_KRAV_COLLECTIONS: readonly string[] = ['oevrigeKravPerioder'];

/** Alle EO-collections, dette modul klassificerer. Completeness-testen itererer produktionskataloget mod den. */
export const EO_CLASSIFIED_COLLECTIONS: readonly string[] = Object.freeze([
  ...SVIE_SMERTE_GROUP.collections,
  ...TAF_COLLECTIONS,
  ...OEVRIGE_KRAV_COLLECTIONS,
]);

/**
 * Alle top-level felt-descriptor-id'er, dette modul klassificerer. DEDUPLIKERET, fordi EO-perioden er en
 * bevidst DELT afhængighed og optræder i både S/S- og TAF-gruppen.
 */
export const EO_CLASSIFIED_FIELD_IDS: readonly string[] = Object.freeze([...new Set([
  ...SVIE_SMERTE_GROUP.fieldIds,
  ...FORLIG_GROUP.fieldIds,
  ...TAF_GROUP.fieldIds,
])]);

/** Collection-navnene på issue-adressens sti. Tom for et top-level-felt. */
const addressCollections = (issue: FieldIssue): readonly string[] =>
  issue.field.address.path.flatMap((segment) => segment.kind === 'entity' ? [segment.collection] : []);

const issueMatchesGroup = (issue: FieldIssue, group: DependencyGroup, collections: readonly string[]): boolean =>
  group.fieldIds.includes(issue.field.descriptor.id)
  || addressCollections(issue).some((collection) => collections.includes(collection));

/**
 * Hvilke af EO's uafhængige grene er blokeret af en rød feltfejl?
 *
 * Resultatet er rent afledt af det strukturelle issue-sæt — der lagres ingen parallel klassifikations-
 * sidekanal ved siden af snapshottets egne invarianter (WI-004-invariant).
 */
export type EoBlockedDependencies = Readonly<{
  /** S/S-GRUNDLAGET (perioder, dage, satsår, tidligere/aktuel betaling) — uden forligsskalering. */
  svieSmerte: boolean;
  /** Forligsskaleringen. Blokerer efter-forlig-satser og -beløb, men ikke før-forlig-grundlaget. */
  forlig: boolean;
  /** TAF-grenen: periodisering, fraværsdage, lønudvikling, SFGG og offentlige ydelser. */
  taf: boolean;
  /** Øvrige krav-rækkerne. Blokerer aggregatet, men ingen af de to motorgrene. */
  oevrigeKrav: boolean;
  /**
   * Er ET ELLER ANDET rødt? Aggregatnodens fail-closed-backstop: en rød feltnøgle, ingen gren genkender,
   * må ikke lydløst forsvinde ud af gatingen — men den må heller ikke gættes ind i en vilkårlig gren.
   */
  aggregate: boolean;
}>;

/**
 * Grenene svarer PRÆCIST til de afhængigheder, motorerne faktisk læser — hverken flere eller færre.
 *
 * ⚠️ Der er BEVIDST ingen `regulering`-gren: reguleringsforløbet har ingen egne felter. En ugyldig manuel
 * reguleringscelle bor i `loenudviklingManuelTableData`/`loenudviklingManuelProcentsatsTableData` og
 * blokerer derfor TAF-grenen, som er den, der faktisk læser den.
 *
 * En gren, der aldrig kan udløses, ville foregøgle en præcision, der ikke findes, og gøre det uklart, hvor
 * blokeringen egentlig afgøres. `eoDependencyGroups.test.ts` itererer produktionskataloget og hævder, at
 * hver klassificeret collection og hvert klassificeret felt faktisk findes — så en omdøbning ikke lydløst
 * gør en gren til død kode, præcis som rækkefragmenterne var før runde 4.
 */
export const resolveEoBlockedDependencies = (
  issues: readonly FieldIssue[],
  stamdataIssues: readonly FieldIssue[] = []
): EoBlockedDependencies => {
  // Afhængigheden går på tværs af SEKTIONER (re-review T2): `stamdata.skadedato` sendes ind i `buildTafRanges`
  // som `skadedatoISO` og afgør, om den midlertidige EET-grænse er aktiv (`tafPeriodConstraints.ts:57` —
  // grænsen gælder kun skader FØR 2011-06-16). Maskeres en rød skadedato til `undefined`, forsvinder grænsen
  // LYDLØST, og periodiseringen bliver uklampet. Skadedatoen klipper også S/S-perioderne gennem samme
  // bounds-resolver. En gate udledt af EO-issues ALENE kunne ikke se det.
  const skadedatoBlocked = stamdataIssues.some((issue) => issue.field.descriptor.id === 'stamdata.skadedato');
  return Object.freeze({
    svieSmerte: skadedatoBlocked
      || issues.some((issue) => issueMatchesGroup(issue, SVIE_SMERTE_GROUP, SVIE_SMERTE_GROUP.collections)),
    forlig: issues.some((issue) => issueMatchesGroup(issue, FORLIG_GROUP, FORLIG_GROUP.collections)),
    taf: skadedatoBlocked || issues.some((issue) => issueMatchesGroup(issue, TAF_GROUP, TAF_COLLECTIONS)),
    oevrigeKrav: issues.some((issue) =>
      addressCollections(issue).some((collection) => OEVRIGE_KRAV_COLLECTIONS.includes(collection))),
    // Fail-closed: ENHVER rød feltfejl gør aggregatet (samlet total, canonicalOutput, pdfModel)
    // ikke-autoritativt — også en, ingen gren genkender. Stamdata-fejl tælles med: de blokerer i forvejen
    // den autoritative beregning gennem stamdata-invarianterne.
    aggregate: issues.length > 0 || stamdataIssues.length > 0,
  });
};
