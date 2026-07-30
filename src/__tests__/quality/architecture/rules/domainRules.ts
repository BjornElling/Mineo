/**
 * Domæne- og laggrænser.
 *
 * Hvem må koble til hvilket domæne. Page-grænsen følger IMPORTGRAFEN (ikke kun direkte imports),
 * så en kobling gennem en projektion eller facade ikke kan gøre reglen tavs.
 *
 * Del af det opdelte arkitekturmanifest (Fase 6, genåbnet): manifestet var 2.133 linjer og blandede
 * storage-, input-, domæne-, UI- og dokumentregler i én fil, hvor en regel og dens nabo intet havde
 * med hinanden at gøre. `architectureRules.ts` samler nu de fem koncern-moduler til ét registry.
 */
import { type PersistedSectionKey } from '../../../../config/persistenceRegistry';
import { collectCalls, collectImports, hasIdentifier, hasTypeReference, resolveRelativeImport } from '../astQueries';
import { type SourceEntry } from '../sourceGraph';
import {
  defineRule,
  forbidElementAccess,
  forbidImports,
  forbidTypeAssertions,
  type Finding,
} from '../ruleKit';

// --- Fail-open display-opslag må ikke koble til beregning ---------------------

export const failOpenDisplayLookupImport = forbidImports({
  id: 'satser/fail-open-display-lookup-import',
  description:
    'Det fail-open getSatserForYear (lovbestemteRates) må kun importeres af display-/dokument-lag — aldrig en beregningssti.',
  liveTarget: {
    kind: 'precondition',
    // R0-F02: AST-signal, ikke tekst — en kommentar, der nævner opslaget, må ikke holde reglen levende.
    probe: (entry) => hasIdentifier(entry, 'getSatserForYear'),
    rationale: 'det fail-open opslag findes stadig og importeres af mindst én fil',
  },
  allow: [
    // Den typed reader-projektion er display-/dokument-grænsen for Satser og kalder kun opslaget på ready-grenen.
    'src/domain/satser/satserProjection.ts',
    'src/document/generators/satser/satserDocument.ts',
  ],
  forbidden: (ref) =>
    ref.moduleSpecifier.includes('lovbestemteRates') && ref.namedBindings.includes('getSatserForYear'),
  message: (ref) => `Import af fail-open getSatserForYear (${ref.moduleSpecifier}) uden for display/dokument.`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear } from '../../data/lovbestemteRates';" },
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear as x } from '../data/lovbestemteRates';" },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: "import { resolveAslAarsloensmaksimumForAar } from '../satser/aslAarsloensmaksimum';" },
    { relativePath: 'src/foo.ts', code: "import { getSatserForYear } from './someOtherModule';" },
    { relativePath: 'src/foo.ts', code: "import { andetSymbol } from '../../data/lovbestemteRates';" },
  ],
});

// --- ASL-årslønsmaksimum: rå subscript-opslag skal gå gennem gateway'en ------

export const aslAarsloensmaksimumRawSubscript = forbidElementAccess({
  id: 'satser/asl-aarsloensmaksimum-raw-subscript',
  description:
    'Rå aarsloenAslMax[år]-opslag skal gå gennem resolveAslAarsloensmaksimumForAar (gateway); kun datakilde + gateway må subscripte.',
  liveTarget: {
    kind: 'precondition',
    // R0-F02: AST-signal, ikke tekst.
    probe: (entry) => hasIdentifier(entry, 'aarsloenAslMax'),
    rationale: 'datatabellen `aarsloenAslMax` findes stadig og kan subscriptes',
  },
  // Kun datakilden tilbage: gateway'en (`aslAarsloensmaksimum.ts`) subscripter ikke længere selv — den går
  // gennem `YearlyRate`-helperne — så dens allowlist-post var død konfiguration.
  allow: ['src/data/lovbestemteRates.ts'],
  forbidden: (ref) => ref.objectName === 'aarsloenAslMax',
  message: (ref) => `Rå ASL-maks-opslag (${ref.chainText}) — brug resolveAslAarsloensmaksimumForAar().`,
  violatingFixtures: [
    { relativePath: 'src/foo.ts', code: 'const v = aarsloenAslMax[year];' },
    { relativePath: 'src/foo.ts', code: 'const v = aarsloenAslMax[skadesaar];' },
  ],
  cleanFixtures: [
    { relativePath: 'src/foo.ts', code: 'const idx = aarsloenAslMax;' },
    { relativePath: 'src/foo.ts', code: 'getYearBoundsForYearlyRate(aarsloenAslMax);' },
    { relativePath: 'src/foo.ts', code: 'resolveAslAarsloensmaksimumForAar(year);' },
  ],
});

// --- Lag-grænse: domæne må ikke importere inspektions-/kontrollaget ----------

const INSPEKTION_LAYER = 'src/domain/eoInspektion';

const importPointsIntoInspektion = (moduleSpecifier: string, fromRelativePath: string): boolean => {
  if (moduleSpecifier.startsWith('.')) {
    const resolved = resolveRelativeImport(fromRelativePath, moduleSpecifier);
    return resolved !== null && (resolved === INSPEKTION_LAYER || resolved.startsWith(`${INSPEKTION_LAYER}/`));
  }
  // Ikke-relative (alias/absolut/bart modul): match på segmentet, så en fremtidig path-alias også fanges.
  return moduleSpecifier.includes('domain/eoInspektion');
};

export const inspektionLayerImport = forbidImports({
  id: 'layer/inspektion-import-boundary',
  description:
    'Kun de to sanktionerede snapshot-bro-filer må importere src/domain/eoInspektion; den autoritative motor + kontrol-kerne skal være inspektionsfri (B9).',
  liveTarget: {
    kind: 'scoped',
    roots: [INSPEKTION_LAYER, 'src/domain'],
    rationale: 'både inspektionslaget (det beskyttede mål) og domænelaget (scopet) skal findes',
  },
  // Alle domæne-filer uden for selve inspektionslaget kontrolleres (dækker eoRowEvaluation, canonicalOutput, controlMismatch m.fl.).
  appliesTo: (relativePath) =>
    relativePath.startsWith('src/domain/') && !relativePath.startsWith(`${INSPEKTION_LAYER}/`),
  allow: [
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts',
    'src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToInspektionView.ts',
  ],
  forbidden: (ref, fromRelativePath) => importPointsIntoInspektion(ref.moduleSpecifier, fromRelativePath),
  message: (ref) => `Import af inspektions-/kontrollaget (${ref.moduleSpecifier}) uden for de sanktionerede broer.`,
  violatingFixtures: [
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/foo.ts',
      code: "import { buildEOInspektionSnapshot } from '../../eoInspektion/eoInspektionSnapshot';",
    },
    { relativePath: 'src/domain/x/y.ts', code: "import { x } from '@/domain/eoInspektion/eoInspektionSnapshot';" },
    { relativePath: 'src/domain/x/y.ts', code: "import { x } from 'src/domain/eoInspektion/eoInspektionSnapshot';" },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/domain/erstatningsopgoerelse/engines/foo.ts',
      code: "import { collectAllEoRows } from '../../eoRowEvaluation/eoRowAggregator';",
    },
    { relativePath: 'src/domain/x/y.ts', code: "import { z } from '@mui/material';" },
  ],
});

// --- EET-domæne: intet tværside-persisted-opslag ind i erhvervsevnetab -------

// `domain/eet-cross-domain-persisted-lookup` er SLETTET i Fase 6.
//
// Reglen forbød `getPersistedData`/`usePersistedSection`/`commitSection` med `'erhvervsevnetab'` som
// literal-argument. Dødt-værn-detektoren afslørede, at ingen af de tre callees findes i grafen længere:
// `usePersistedSection` og `commitSection` har nul forekomster overhovedet, og `getPersistedData` lever
// kun som devtools-monitoreringens callback (`useDevtoolsMonitoring.ts`), som ikke er en sektionsadgang.
// Reglen var altså grøn af tomhed.
//
// Intentionen — EET må ikke kobles til af et fremmed domæne — er IKKE opgivet: den håndhæves nu af
// `domain/page-section-access-boundary`, som efter Fase 6 måler den kobling, greenfield faktisk har
// (hvilket descriptor-katalog en side importerer), mod den samme autorisationstabel. Det er en STÆRKERE
// kontrol end den slettede, fordi den dækker alle sektioner og ikke kun literal-argumenter.

// --- Pengeenhed: kun den kanoniske konstruktor må skabe MoneyOre -------------

export const moneyOreTypeAssertion = forbidTypeAssertions({
  id: 'money/money-ore-type-assertion',
  description:
    'MoneyOre må ikke konstrueres med type-assertion; brug den validerede pengealgebra.',
  liveTarget: {
    kind: 'precondition',
    // R0-F02: MoneyOre findes kun i TYPE-positioner (den importeres som type), så typereferencen er
    // signalet. En tekstprobe ville også ramme navnet i en kommentar.
    probe: (entry) => hasTypeReference(entry, 'MoneyOre'),
    rationale: 'MoneyOre-typen findes stadig og kan asserteres til',
  },
  forbidden: (ref) => /(?:^|\.)MoneyOre$/.test(ref.typeText),
  message: (ref) =>
    `Type-assertion til ${ref.typeText} omgår MoneyOre-valideringen — brug domain/money.`,
  violatingFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = 100 as MoneyOre;' },
    { relativePath: 'src/x.ts', code: 'const x = <MoneyOre>100;' },
    { relativePath: 'src/x.ts', code: 'const x = value as unknown as MoneyOre;' },
  ],
  cleanFixtures: [
    { relativePath: 'src/x.ts', code: 'const x = moneyOre(100);' },
    { relativePath: 'src/x.ts', code: 'const x = value as number;' },
  ],
});

// --- Page-lag: persisteret sektionsadgang må kun ramme autoriserede domæner ---

/**
 * Hvilket persisteret domæne hvert descriptor-katalog giver adgang til.
 *
 * **Fase 6 omskrev denne regel fra kald til imports.** Første udgave målte string-literal-argumenter
 * til sektions-hooks (`usePersistedForm('aarsloen')` …). Dødt-værn-detektoren afslørede, at ALLE de
 * hooks er væk efter greenfield-cutoveren: `usePersistedSection`/`commitSection` har nul forekomster,
 * og de øvrige lever kun som historik-kommentarer i page-filerne. Reglen kontrollerede altså en
 * adgangsform, produktionen ikke længere har — grøn af tomhed, mens den fremstod som §9/§10-dækning.
 *
 * Greenfield kobler en side til et domæne ét sted: ved at importere domænets FELTDESCRIPTORER fra
 * `src/inputCore/catalog/`. Descriptoren bærer selv sin `section`, og uden en descriptor kan siden
 * hverken læse eller skrive sektionen. Import af kataloget ER derfor koblingen — og i modsætning til
 * literal-argumenter kan den ikke omgås ved at føre sektionsnavnet gennem en variabel.
 *
 * Autorisationstabellen (`PAGE_BOUNDARY_RULES`) er UÆNDRET: det er domain-boundary-contract §9/§10's
 * beslutning om hvem der må røre hvad, og den er stadig gyldig. Kun målemetoden er skiftet til den,
 * arkitekturen faktisk bruger.
 */
const DESCRIPTOR_CATALOG_SECTIONS: ReadonlyMap<string, PersistedSectionKey> = new Map([
  ['aarsloenDescriptors', 'aarsloen'],
  ['erhvervsevnetabDescriptors', 'erhvervsevnetab'],
  ['erstatningsopgoerelseDescriptors', 'erstatningsopgoerelse'],
  ['erstatningsopgoerelseLoenDescriptors', 'erstatningsopgoerelse'],
  ['faellesAarsloenDescriptors', 'faellesAarsloen'],
  ['forsoergertabDescriptors', 'forsoergertab'],
  ['renteberegningDescriptors', 'renteberegning'],
  ['satserDescriptors', 'satser'],
  ['stamdataDescriptors', 'stamdata'],
  ['varigeMenDescriptors', 'varigemen'],
]);

/**
 * Descriptor-katalogets mappe. Eksporteret, så `deletedLegacyAbsence.test.ts` kan bevise, at
 * `DESCRIPTOR_CATALOG_SECTIONS` dækker HVERT katalogmodul: et nyt domænekatalog, der ikke står i
 * kortet, ville ellers være usynligt for page-grænsen — reglen ville se en uovervåget kobling som
 * "ingen kobling" og være tavs, altså grøn af tomhed frem for grøn af bevis.
 */
export const CATALOG_DIR = 'src/inputCore/catalog';

/**
 * De katalogmoduler der IKKE er et domæne (fælles infrastruktur) og derfor ingen sektion har.
 *
 * `fieldLocationCatalog` hører her, fordi det netop går PÅ TVÆRS af samtlige sektioner: det knytter hvert
 * produktionsdescriptor til sin route/fane. En post i sektionskortet ville påstå, at modulet tilhører ét
 * domæne, og page-grænsen ville da måle det forkerte.
 */
export const NON_DOMAIN_CATALOG_MODULES: readonly string[] = [
  'boundsValidators',
  'productionCatalog',
  'fieldLocationCatalog',
];

/** Til completeness-testen: hvilke katalogmoduler kortet kender. */
export const DESCRIPTOR_CATALOG_MODULE_NAMES: readonly string[] = [...DESCRIPTOR_CATALOG_SECTIONS.keys()];

/** Descriptor-katalogets sektion, hvis importen peger på ét — ellers null. */
const catalogSectionForImport = (moduleSpecifier: string): PersistedSectionKey | null => {
  const normalized = moduleSpecifier.replaceAll('\\', '/');
  const match = /(?:^|\/)inputCore\/catalog\/([A-Za-z]+)$/.exec(normalized);
  if (match === null) return null;
  return DESCRIPTOR_CATALOG_SECTIONS.get(match[1]) ?? null;
};

const PAGES_ROOT = 'src/components/pages';
const CROSS_DOMAIN_PORT_BOUNDARIES = new Set([
  'src/domain/erstatningsopgoerelse/forligInputPort',
  'src/domain/erhvervsevnetab/eetImportPort',
]);

export type PageBoundaryRule = Readonly<{
  label: string;
  /** Repo-relativ rod (fil eller mappe) med `src/`-præfiks, matcher `SourceEntry.relativePath`. */
  root: string;
  allowedSections: readonly PersistedSectionKey[];
}>;

/**
 * Domain-boundary-contract §9/§10: hvilke persisterede sektioner hver page-rod må
 * tilgå. Erstatningsopgørelse/Erhvervsevnetab har autoriserede cross-domain-læsninger
 * (delt forligsgrad + midlertidigt EET) — resten er strengt eget domæne + stamdata.
 */
export const PAGE_BOUNDARY_RULES: readonly PageBoundaryRule[] = [
  { label: 'Årslønsberegning', root: 'src/components/pages/Aarsloen.tsx', allowedSections: ['aarsloen', 'stamdata'] },
  {
    label: 'Årslønsberegning sektioner',
    root: 'src/components/pages/aarsloen',
    allowedSections: ['aarsloen', 'stamdata'],
  },
  {
    label: 'Erhvervsevnetab',
    root: 'src/components/pages/Erhvervsevnetab.tsx',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata'],
  },
  {
    label: 'Erhvervsevnetab tabs',
    root: 'src/components/pages/erhvervsevnetab',
    allowedSections: ['erhvervsevnetab', 'faellesAarsloen', 'stamdata'],
  },
  {
    label: 'Erstatningsopgørelse',
    root: 'src/components/pages/Erstatningsopgoerelse.tsx',
    allowedSections: ['erstatningsopgoerelse', 'stamdata'],
  },
  {
    label: 'Erstatningsopgørelse tabs',
    root: 'src/components/pages/erstatningsopgoerelse',
    // `erhvervsevnetab`/`faellesAarsloen` er med, fordi Beregning-fanen bærer "midlertidigt EET fra
    // EET-siden": dokumentdefinitionerne læser EET's reader-projektion for at injicere de virtuelle
    // rækker (`domain-boundary-contract.md` §9). Koblingen er TRANSITIV og var derfor usynlig, indtil
    // reglen begyndte at følge importgrafen — den er den samme autorisation, `Erstatningsopgoerelse.tsx`
    // allerede havde, og listerne er nu ens for side og faner.
    allowedSections: ['erstatningsopgoerelse', 'stamdata'],
  },
  { label: 'Forsørgertab', root: 'src/components/pages/Forsoergertab.tsx', allowedSections: ['forsoergertab', 'faellesAarsloen', 'stamdata'] },
  {
    // Forsørgertabs viewmodel + sektion-komponenter (R7-F01's VM-lag). Autorisationen er DEN SAMME som
    // sidens: sektionslaget er sidens eget, og en anden liste her ville betyde, at ansvaret kunne flyttes
    // over grænsen ved at flytte en fil ned i mappen.
    label: 'Forsørgertab sektioner',
    root: 'src/components/pages/forsoergertab',
    allowedSections: ['forsoergertab', 'faellesAarsloen', 'stamdata'],
  },
  { label: 'Renteberegning', root: 'src/components/pages/Renteberegning.tsx', allowedSections: ['renteberegning', 'stamdata'] },
  {
    // Delte renteberegning-faner (bruges af både hovedapp og standalone minProcesrente). RenteberegningTab
    // binder beregningsdato til den afsluttede inputrevision, så filen tilgår
    // `renteberegning`-sektionen.
    // `stamdata` er med efter R7-F01: sidens viewmodel bor nu her og komponerer de to rente-dokument-
    // definitioner, som læser brevhovedets stamdata. Autorisationen er dermed identisk med
    // `Renteberegning.tsx`' egen — koblingen er den samme, kun filen er flyttet.
    label: 'Renteberegning-faner',
    root: 'src/components/pages/renteberegning',
    allowedSections: ['renteberegning', 'stamdata'],
  },
  { label: 'Satser', root: 'src/components/pages/Satser.tsx', allowedSections: ['satser', 'stamdata'] },
  {
    label: 'Satser sektioner',
    root: 'src/components/pages/satser',
    allowedSections: ['satser', 'stamdata'],
  },
  { label: 'Stamdata', root: 'src/components/pages/Stamdata.tsx', allowedSections: ['stamdata'] },
  { label: 'Stamdata sektioner', root: 'src/components/pages/stamdata', allowedSections: ['stamdata'] },
  { label: 'Varige mén', root: 'src/components/pages/VarigeMen.tsx', allowedSections: ['stamdata', 'varigemen'] },
  { label: 'Varige mén tabs', root: 'src/components/pages/varigemen', allowedSections: ['stamdata', 'varigemen'] },
  {
    label: 'MinProcesrente (standalone)',
    root: 'src/components/pages/minprocesrente',
    allowedSections: ['renteberegning'],
  },
];

// --- Hvem må kalde en beregningsmotor (WI-005) --------------------------------

/**
 * ANSVARSGRÆNSE: en beregningsmotor kaldes KUN af sin egen reader-projektion.
 *
 * `§7.3`/GM-F07: motoren fodres kun fra en `ready`-projektion. Grænsen holdt i praksis — nul callsites uden for
 * projektionerne — men den var UBEVOGTET: intet ville have fanget en side, en dokumentdefinition eller en
 * komponent, der greb direkte efter motoren og dermed omgik gaten. Netop det er WI-005's ønskede slutbillede:
 * værn, der håndhæver ANSVAR (hvem må kalde en motor) frem for de NAVNE, migrationen kom fra.
 *
 * Kortet er 1:1 og udtømmende pr. slice, så det ikke kan udvandes: hver motor har præcis ÉN lovlig kalder.
 * En syvende slice, hvis motor får en anden kalder, skal registreres her — og en motor, hvis navn forsvinder,
 * gør liveness-kontrollen rød frem for at efterlade reglen grøn af tomhed.
 */
const ENGINE_ENTRYPOINT_OWNERS: ReadonlyMap<string, string> = new Map([
  ['computeEoSnapshot', 'src/domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection.ts'],
  ['computeEetSnapshot', 'src/domain/erhvervsevnetab/erhvervsevnetabReaderProjection.ts'],
  ['computeForsoergertabSnapshot', 'src/domain/forsoergertab/forsoergertabReaderProjection.ts'],
  ['computeAarsloenBeregning', 'src/domain/aarsloen/aarsloenProjection.ts'],
  ['computeVarigeMenEngine', 'src/domain/varigemen/varigeMenReaderProjection.ts'],
  ['computeRentekravRow', 'src/domain/renteberegning/renteberegningReaderProjection.ts'],
]);

const ENGINE_ENTRYPOINT_NAMES: readonly string[] = [...ENGINE_ENTRYPOINT_OWNERS.keys()];

/** Kalder filen en motor, den ikke ejer? Måles som KALD (ikke import), så en type-only reference er lovlig. */
const collectForeignEngineCalls = (entry: SourceEntry): readonly Finding[] =>
  collectCalls(entry)
    .filter((ref) => {
      const owner = ENGINE_ENTRYPOINT_OWNERS.get(ref.calleeName);
      return owner !== undefined && owner !== entry.relativePath;
    })
    .map((ref) => ({
      position: ref.position,
      message:
        `\`${ref.calleeName}(...)\` er en beregningsmotor, som kun må kaldes af sin egen reader-projektion `
        + `(${ENGINE_ENTRYPOINT_OWNERS.get(ref.calleeName)}). Motoren fodres KUN fra en \`ready\`-projektion `
        + '(§7.3/GM-F07); et direkte kald herfra omgår dependency-gaten, så et tal kan beregnes på input, der '
        + 'ikke rækker til det. Læs projektionens resultat i stedet.',
    }));

export const engineCallOwnedByProjectionRule = defineRule({
  id: 'domain/engine-call-owned-by-projection',
  description:
    'En beregningsmotor kaldes kun af sin egen reader-projektion (§7.3/GM-F07). Et direkte motorkald fra en '
    + 'side, en dokumentdefinition eller en komponent omgår dependency-gaten (WI-005).',
  liveTarget: {
    kind: 'precondition',
    // Målet er motorernes EJERE: hver projektion skal stadig kalde sin motor. Holder en projektion op med at
    // gøre det, er slicens beregningsvej flyttet, og kortet skal følge med frem for at stå grønt.
    probe: (entry) => {
      const owned = ENGINE_ENTRYPOINT_NAMES.filter(
        (name) => ENGINE_ENTRYPOINT_OWNERS.get(name) === entry.relativePath
      );
      if (owned.length === 0) return false;
      const called = new Set(collectCalls(entry).map((ref) => ref.calleeName));
      return owned.every((name) => called.has(name));
    },
    rationale:
      'hver af de seks slice-motorer kaldes stadig af sin egen reader-projektion; forsvinder en af dem, skal '
      + 'ENGINE_ENTRYPOINT_OWNERS følge den nye beregningsvej',
    minimumMatches: 6,
    requiredPaths: [...new Set(ENGINE_ENTRYPOINT_OWNERS.values())],
  },
  // Måles over HELE kildegrafen: fundet er "en fil, der ikke ejer motoren, kalder den", og den fil kan ligge
  // hvor som helst. En scope-begrænsning til fx `src/components` ville efterlade dokumentlaget ubevogtet.
  find: (entry) => collectForeignEngineCalls(entry),
  allow: [],
  violatingFixtures: [
    // Den konkrete fejlform: en side, der griber direkte efter motoren og dermed omgår gaten.
    {
      relativePath: 'src/components/pages/Forsoergertab.tsx',
      code: 'const snapshot = computeForsoergertabSnapshot({ values });',
    },
    // En dokumentdefinition ville have samme virkning — outputtet ville bære et ugatet tal.
    {
      relativePath: 'src/domain/forsoergertab/forsoergertabDocumentDefinition.ts',
      code: 'const s = computeForsoergertabSnapshot(input);',
    },
    // En ANDEN projektion må heller ikke kalde en fremmed slices motor.
    {
      relativePath: 'src/domain/aarsloen/aarsloenProjection.ts',
      code: 'const s = computeEoSnapshot(input);',
    },
  ],
  cleanFixtures: [
    // Ejeren selv kalder naturligvis sin egen motor.
    {
      relativePath: 'src/domain/forsoergertab/forsoergertabReaderProjection.ts',
      code: 'const snapshot = computeForsoergertabSnapshot({ values });',
    },
    // En TYPE-reference er ikke et kald; snapshottypen deles bredt og skal blive ved at kunne det.
    {
      relativePath: 'src/components/pages/Forsoergertab.tsx',
      code: "import type { ForsoergertabSnapshot } from '../../domain/forsoergertab/forsoergertabSnapshot';\n"
        + 'const f = (s: ForsoergertabSnapshot) => s;',
    },
    // En KOMMENTAR, der nævner motoren, må ikke bære reglen (INC-F03's lærepunkt).
    {
      relativePath: 'src/components/pages/Forsoergertab.tsx',
      code: '// Projektionen kalder computeForsoergertabSnapshot() uændret (§5.4).\nconst x = 1;',
    },
  ],
});

const boundaryRuleForPath = (relativePath: string): PageBoundaryRule | undefined =>
  PAGE_BOUNDARY_RULES.find(
    (rule) => relativePath === rule.root || relativePath.startsWith(`${rule.root}/`)
  );

type SectionAccess = Readonly<{
  section: PersistedSectionKey;
  position: Finding['position'];
  /** Kæden fra page-filen til descriptor-kataloget. Ét led = direkte import. */
  via: readonly string[];
}>;

/**
 * TRANSITIV domænekobling (Fase 6, genåbnet).
 *
 * Reglen målte tidligere kun DIREKTE descriptor-imports i page-filen. Det var en reel blindhed: den
 * greenfield-arkitektur, planen selv foreskriver, lader siden importere en domæne-PROJEKTION, som
 * importerer descriptor-katalogerne. `Erhvervsevnetab.tsx` → `erhvervsevnetabReaderProjection.ts` →
 * fire sektioners kataloger var derfor helt usynlig for grænsen, mens reglen fremstod som dækning.
 *
 * Nu følger målingen importgrafen. En kobling gennem en projektion er stadig en kobling — det er
 * netop hvad §9/§10's autorisationstabel handler om — men diagnostikken viser KÆDEN, så et fund kan
 * læses: "siden kobler til `satser` gennem `xReaderProjection`".
 *
 * Grænsen er bevidst sat ved page-filens transitive lukning frem for ved dens direkte imports, fordi
 * en facade eller et alias ellers kan flytte koblingen ét modul væk og gøre reglen tavs.
 */
const collectSectionAccessesDeep = (
  entry: SourceEntry,
  byPath: ReadonlyMap<string, SourceEntry>
): readonly SectionAccess[] => {
  const accesses: SectionAccess[] = [];
  const seen = new Set<string>([entry.relativePath]);

  type Frame = Readonly<{
    entry: SourceEntry;
    chain: readonly string[];
    rootPosition?: Finding['position'];
  }>;
  const queue: Frame[] = [{ entry, chain: [] }];

  while (queue.length > 0) {
    const frame = queue.shift();
    if (frame === undefined) break;
    for (const ref of collectImports(frame.entry)) {
      // Også type-only imports tæller: en side, der kender domænets felttyper, er koblet til domænet,
      // og en type-import er desuden ét tegn fra at blive en værdi-import.
      const section = catalogSectionForImport(ref.moduleSpecifier);
      if (section !== null) {
        // Positionen er ALTID i page-filen selv (det første led), så fundet peger på den import,
        // udvikleren kan gøre noget ved — ikke på en linje dybt inde i domænet.
        accesses.push({
          section,
          position: frame.rootPosition ?? ref.position,
          via: frame.chain,
        });
        continue;
      }
      const resolved = resolveRelativeImport(frame.entry.relativePath, ref.moduleSpecifier);
      if (resolved === null) continue;
      // En navngiven cross-domain-port er selve capability-grænsen. Consumers må kende portens output,
      // men ikke dens interne descriptor-afhængigheder; portmodulet kontrolleres særskilt nedenfor.
      if (CROSS_DOMAIN_PORT_BOUNDARIES.has(resolved)) continue;
      for (const candidate of [`${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.ts`]) {
        const next = byPath.get(candidate);
        if (next === undefined || seen.has(next.relativePath)) continue;
        seen.add(next.relativePath);
        queue.push({
          entry: next,
          chain: [...frame.chain, next.relativePath],
          rootPosition: frame.rootPosition ?? ref.position,
        });
      }
    }
  }

  return accesses;
};

/**
 * Den DIREKTE kobling. Bevares til `findInFile` (anti-rot) og til `probe`, hvor grafen ikke er
 * tilgængelig: begge skal kunne besvares ud fra én fil.
 */
const collectSectionAccesses = (entry: SourceEntry): SectionAccess[] =>
  collectImports(entry).flatMap((ref) => {
    const section = catalogSectionForImport(ref.moduleSpecifier);
    return section === null ? [] : [{ section, position: ref.position, via: [] }];
  });

export const pageSectionAccessBoundary = defineRule({
  id: 'domain/page-section-access-boundary',
  description:
    'Enhver page-fil der importerer et domænes feltdescriptorer skal ligge under en PAGE_BOUNDARY_RULE-rod (coverage) og må kun koble til rodens autoriserede sektioner (domain-boundary-contract §9/§10).',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) =>
      entry.relativePath.startsWith(`${PAGES_ROOT}/`) && collectSectionAccesses(entry).length > 0,
    rationale:
      'mindst én page-fil importerer et descriptor-katalog — dvs. koblingen, reglen regulerer, findes '
      + 'stadig i den form, greenfield bruger',
  },
  appliesTo: (relativePath) => relativePath.startsWith(`${PAGES_ROOT}/`),
  find: (entry, graph) => {
    const byPath = new Map(graph.map((item) => [item.relativePath, item]));
    const accesses = collectSectionAccessesDeep(entry, byPath);
    if (accesses.length === 0) return [];

    const describeChain = (via: readonly string[]): string =>
      via.length === 0 ? 'descriptor-katalog' : `${via.join(' → ')} → descriptor-katalog`;

    const boundary = boundaryRuleForPath(entry.relativePath);
    if (!boundary) {
      // Coverage-completeness: en page-fil med domænekobling uden en regel-rod er uovervåget.
      return accesses.map((access) => ({
        position: access.position,
        message: `Uovervåget page-fil med domænekobling (${access.section}) — tilføj en PAGE_BOUNDARY_RULE-rod.`,
      }));
    }

    // Dedupliker pr. sektion: en side kan nå samme sektion gennem flere kæder, og ét fund pr. sektion
    // er den handlingsbare enhed (autorisationstabellen er sektions-, ikke sti-baseret).
    const reported = new Set<PersistedSectionKey>();
    return accesses
      .filter((access) => !boundary.allowedSections.includes(access.section))
      .filter((access) => {
        if (reported.has(access.section)) return false;
        reported.add(access.section);
        return true;
      })
      .map((access) => ({
        position: access.position,
        message:
          `${boundary.label}: kobling til ikke-autoriseret sektion '${access.section}' via `
          + `${describeChain(access.via)}.`,
      }));
  },
  violatingFixtures: [
    // Under en rod, men uautoriseret sektion.
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import { x } from '../../inputCore/catalog/erhvervsevnetabDescriptors';",
    },
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx',
      code: "import { x } from '../../../inputCore/catalog/renteberegningDescriptors';",
    },
    // Ingen rod (uovervåget) med domænekobling.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { x } from '../../inputCore/catalog/stamdataDescriptors';",
    },
    // Type-only kobling til et uautoriseret domæne tæller også.
    {
      relativePath: 'src/components/pages/Satser.tsx',
      code: "import type { X } from '../../inputCore/catalog/varigeMenDescriptors';",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/components/pages/Aarsloen.tsx',
      code: "import { aarsloenFeriePctField } from '../../inputCore/catalog/aarsloenDescriptors';",
    },
    // Autoriseret cross-domain-læsning (EO ↔ EET, delt forligsgrad).
    {
      relativePath: 'src/components/pages/Erhvervsevnetab.tsx',
      code: "import { forligInputFields } from '../../domain/erstatningsopgoerelse/forligInputPort';",
    },
    // Descriptorfri page-fil er uinteressant, selv uden rod.
    { relativePath: 'src/components/pages/NyUovervaagetSide.tsx', code: 'const x = useMemo(() => 1, []);' },
    // Ikke-katalog-import fra inputCore er ikke en domænekobling.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { useFieldEditor } from '../../inputCore/react/useFieldEditor';",
    },
    // Fælles infrastruktur i kataloget (bounds-validatorer) er ikke et domæne.
    {
      relativePath: 'src/components/pages/NyUovervaagetSide.tsx',
      code: "import { dateBounds } from '../../inputCore/catalog/boundsValidators';",
    },
  ],
});

export const crossDomainDescriptorPort = forbidImports({
  id: 'domain/cross-domain-descriptor-port',
  description:
    'EO og EET må kun nå hinandens persisted felter gennem de to navngivne porte; direkte import af det '
    + 'fremmede descriptorkatalog er forbudt.',
  liveTarget: {
    kind: 'precondition',
    probe: (entry) => CROSS_DOMAIN_PORT_BOUNDARIES.has(entry.relativePath.replace(/\.ts$/, '')),
    rationale: 'begge navngivne cross-domain-porte findes som de eneste capabilities',
    requiredPaths: [
      'src/domain/erstatningsopgoerelse/forligInputPort.ts',
      'src/domain/erhvervsevnetab/eetImportPort.ts',
    ],
  },
  appliesTo: (path) =>
    /^(?:src\/domain|src\/components\/pages)\/(?:erhvervsevnetab|erstatningsopgoerelse)/.test(path),
  allow: [],
  forbidden: (ref, fromPath) => {
    const specifier = ref.moduleSpecifier.replaceAll('\\', '/');
    const fromEet = /\/erhvervsevnetab(?:\/|[A-Z])/.test(fromPath);
    const fromEo = /\/erstatningsopgoerelse(?:\/|[A-Z])/.test(fromPath);
    return (fromEet && /inputCore\/catalog\/erstatningsopgoerelse(?:Loen)?Descriptors$/.test(specifier))
      || (fromEo && /inputCore\/catalog\/erhvervsevnetabDescriptors$/.test(specifier));
  },
  message: (ref) =>
    `Direkte cross-domain descriptorimport (${ref.moduleSpecifier}) — brug forligInputPort/eetImportPort.`,
  violatingFixtures: [
    {
      relativePath: 'src/domain/erhvervsevnetab/x.ts',
      code: "import { x } from '../../inputCore/catalog/erstatningsopgoerelseDescriptors';",
    },
    {
      relativePath: 'src/components/pages/erstatningsopgoerelse/X.tsx',
      code: "import { x } from '../../../inputCore/catalog/erhvervsevnetabDescriptors';",
    },
  ],
  cleanFixtures: [
    {
      relativePath: 'src/domain/erhvervsevnetab/x.ts',
      code: "import { forligInputFields } from '../erstatningsopgoerelse/forligInputPort';",
    },
  ],
});

// `form/persisted-styled-field-error-reporter` er SLETTET i Fase 6.
//
// Reglen krævede en `onFieldError`-prop på parse-kompetente `Styled*Field`-komponenter på
// produktionssider. Trin 13 slettede hele den feltvej, og dødt-værn-detektoren afslørede, at reglen
// derfor ikke havde ét eneste mål tilbage: `grep '<Styled[A-Za-z]*Field'` under `src/components/pages/`
// giver nul træffere.
//
// Invarianten — "et persisteret parse-felt må ikke fejle åbent" — er ikke opgivet; den er blevet
// STRUKTUREL og kan derfor ikke længere brydes af en udeladt prop:
//
//   - Greenfield-feltvejen (`src/inputCore/react/fields/`) tager `field: FieldRef<T>` og
//     `location: EditorLocation` som PÅKRÆVEDE props. Uden dem kompilerer feltet ikke.
//   - Fejlvisningen afledes af `useFormFieldSurface`/`useGridCellSurface` fra det tokenbundne
//     issue-snapshot (§1.8) — ikke af en valgfri callback. Der er intet `onFieldError` at udelade;
//     et felt kan ikke opt-out af sin egen fejltilstand.
//
// Fase 6's krav "persisted controls kræver konkrete refs" er dermed opfyldt af TYPEN frem for af en
// regel — samme rangorden som `ManifestStorageKey` etablerede
// ([[project_typed_write_boundary_over_ast_guard]]). En pro forma-regel oven på en compiler-håndhævet
// invariant ville være regel-antal uden dækning, og ville selv være det næste døde værn.
