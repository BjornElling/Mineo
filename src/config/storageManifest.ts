/**
 * Storage Manifest
 *
 * Centraliseret definition af alle sessionStorage keys brugt i Mineo.
 * Dette sikrer type-safety og forhindrer typos ved gem/hent operationer.
 *
 * Namespace-isolation: Alle keys får et variant-prefix (default `mineo`). MinProcesrente-
 * standalone-buildet kalder `setStorageNamespace('minprocesrente')` ved bootstrap — FØR
 * nogen storage-adgang sker — så de to varianter aldrig deler sessionStorage-keys, selv
 * hvis de en dag serveres fra samme origin (lokal dev, preview, sti-baseret deploy).
 * Mineo beholder de uændrede `mineo_*`-keys, så eksisterende data bevares.
 *
 * Keys resolveres dovent (ved access) via getters, fordi `setStorageNamespace` skal kunne
 * sættes på entrypoint-niveau efter dette modul er importeret.
 */

/**
 * En sessionStorage-nøgle, der BEVISLIGT stammer fra dette manifest.
 *
 * Branden er strukturel, ikke kosmetisk: `safeSessionStorage`-skrivefunktionerne tager kun denne
 * type, og den kan udelukkende produceres her. En vilkårlig streng — fx en genindført
 * `'mineo_invalidDrafts'` — kan derfor ikke skrives, og compileren fanger det ved DEFINITIONEN
 * frem for ved en AST-regel, der kun ser literaler (og dermed kunne omgås med en variabel).
 * Læsning/sletning tager fortsat `string`: at rydde op efter en ukendt nøgle er lovligt,
 * at skabe ny persisteret tilstand under den er ikke.
 */
export type ManifestStorageKey = string & { readonly __manifestStorageKey: unique symbol };

const asManifestKey = (key: string): ManifestStorageKey => key as ManifestStorageKey;

let storageNamespace = 'mineo';

/**
 * Sæt storage-namespace for hele app-varianten. Skal kaldes ÉN gang ved bootstrap,
 * før nogen sessionStorage-adgang. Idempotent for samme værdi.
 */
export const setStorageNamespace = (namespace: string): void => {
  storageNamespace = namespace;
};

export const getStorageNamespace = (): string => storageNamespace;

const ns = (suffix: string): string => `${storageNamespace}_${suffix}`;

const UI_STORAGE_KEY_SUFFIXES = {
  lastSavedFilename: 'ui_lastSavedFilename',
  lastSavedFilenameBasis: 'ui_lastSavedFilenameBasis',
  loentrinFinderOverlay: 'ui_loentrinFinderOverlay',
  eoOffentligeYdelserHelpers: 'ui_eoOffentligeYdelserHelpers',
  devtoolsLastSeenIssueId: 'ui_devtools_lastSeenIssueId',
  sideMenuExpanded: 'sideMenuExpanded',
} as const;

const ACTIVE_TAB_SUFFIX_PREFIX = 'ui_activeTab_';

/**
 * Reset-policyen (`persistence-contract.md` §3.8, R4-F02): hvilke manifest-ejede UI-nøgler `Slet alt` skal
 * rydde. Klassifikationen bor HER, i manifestet, fordi den er en egenskab ved nøglen — ikke ved den use-case,
 * der tilfældigvis kalder `Slet alt`. En ny nøgle tvinges til at vælge side af `SESSION_RESET_POLICY`, og
 * `Slet alt` enumererer klassifikationen frem for at gentage en håndskrevet liste.
 *
 * `caseScoped`: sagsnær tilstand — brugerindtastede hjælpeværdier og filnavns-/filhåndtags-metadata, der hører
 * til PRÆCIS den sag, der slettes. Overlever den ikke en bekræftet hel-sags-clear, kan den hydrere ind i den
 * næste, tomme sag og påvirke den (fundets konkrete symptom).
 *
 * `deviceScoped`: uafhængig UI-præference eller devtools-tilstand, som ikke beskriver sagen. Ryddes bevidst
 * IKKE — kontraktens §3.7 holder den uden for inputenvelopen, og en bruger, der sletter sin sag, har ikke
 * bedt om at få sidemenuen foldet sammen.
 */
const SESSION_RESET_POLICY = {
  lastSavedFilename: 'caseScoped',
  lastSavedFilenameBasis: 'caseScoped',
  loentrinFinderOverlay: 'caseScoped',
  eoOffentligeYdelserHelpers: 'caseScoped',
  devtoolsLastSeenIssueId: 'deviceScoped',
  sideMenuExpanded: 'deviceScoped',
} as const satisfies { readonly [K in keyof typeof UI_STORAGE_KEY_SUFFIXES]: 'caseScoped' | 'deviceScoped' };

/**
 * De sagsnære nøgler, `Slet alt` skal rydde — i deklarationsrækkefølge, resolveret mod det AKTUELLE namespace.
 * Aktive-fane-nøglerne er bevidst udenfor: en fane er en navigationsposition, ikke sagsdata.
 */
export const getCaseScopedSessionStorageKeys = (): readonly ManifestStorageKey[] =>
  (Object.keys(SESSION_RESET_POLICY) as (keyof typeof SESSION_RESET_POLICY)[])
    .filter((name) => SESSION_RESET_POLICY[name] === 'caseScoped')
    .map((name) => asManifestKey(ns(UI_STORAGE_KEY_SUFFIXES[name])));

/**
 * Den ENESTE sessionStorage-nøgle for sagsinput (draft/commit-designet §2.1.6/§3.7): hele det
 * afsluttede inputaggregat ligger i én envelope under denne nøgle.
 *
 * De tidligere per-sektion-nøgler (`mineo_stamdata`, `mineo_satser`, …) og `invalidDrafts`-
 * recovery-kanalen er SLETTET sammen med den parallelle legacy-inputklynge (2026-07-25,
 * 2026-07-25) og må ikke genindføres — sektionsopdelt persistering er ikke længere en
 * skrivegrænse, jf. `persistence-contract.md`. Sektions-BEGREBET lever videre som
 * `PERSISTED_SECTION_KEYS` i `persistenceRegistry.ts`, som er den ene kilde til hvilke sektioner
 * en `.eo`-fil indeholder.
 */
const CURRENT_INPUT_ENVELOPE_SUFFIX = 'input_v2';

const buildKeyMap = <T extends Record<string, string>>(
  suffixes: T
): { readonly [K in keyof T]: ManifestStorageKey } => {
  const descriptors = {} as { [K in keyof T]: PropertyDescriptor };
  for (const name of Object.keys(suffixes) as (keyof T)[]) {
    descriptors[name] = {
      enumerable: true,
      get: () => asManifestKey(ns(suffixes[name])),
    };
  }
  return Object.defineProperties({} as { [K in keyof T]: ManifestStorageKey }, descriptors);
};

export const UI_STORAGE_KEYS = buildKeyMap(UI_STORAGE_KEY_SUFFIXES);

export const createActiveTabStorageKey = (pageId: string): ManifestStorageKey =>
  asManifestKey(ns(`${ACTIVE_TAB_SUFFIX_PREFIX}${pageId}`));

/** Current-only envelope-nøgle for inputkernen (§2.1.6). Namespace-aware og dovent resolveret. */
export const getCurrentInputEnvelopeStorageKey = (): ManifestStorageKey =>
  asManifestKey(ns(CURRENT_INPUT_ENVELOPE_SUFFIX));

/**
 * Tjek om en sessionStorage key er en gyldig key for den aktive variant.
 *
 * Sættene bygges dynamisk fra aktuelt namespace, så `setStorageNamespace` virker
 * uanset import-rækkefølge.
 */
export const isValidStorageKey = (key: string): boolean => {
  const uiKeys = Object.values(UI_STORAGE_KEYS) as string[];
  return uiKeys.includes(key)
    || key === ns(CURRENT_INPUT_ENVELOPE_SUFFIX)
    || key.startsWith(ns(ACTIVE_TAB_SUFFIX_PREFIX));
};
