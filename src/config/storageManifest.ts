/**
 * Storage Manifest
 *
 * Centraliseret definition af alle sessionStorage keys brugt i Mineo.
 * Dette sikrer type-safety og forhindrer typos ved gem/hent operationer.
 *
 * Namespace-isolation: Alle keys får et variant-prefix (default `mineo`). MinProcesrente-
 * standalone-buildet kalder `setStorageNamespace('minprocesrente')` ved bootstrap – FØR
 * nogen storage-adgang sker – så de to varianter aldrig deler sessionStorage-keys, selv
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
 * type, og den kan udelukkende produceres her. En vilkårlig streng – fx en genindført
 * `'mineo_invalidDrafts'` – kan derfor ikke skrives, og compileren fanger det ved DEFINITIONEN
 * frem for ved en AST-regel, der kun ser literaler (og dermed kunne omgås med en variabel).
 * Læsning/sletning tager fortsat `string`: at rydde op efter en ukendt nøgle er lovligt,
 * at skabe ny persisteret tilstand under den er ikke.
 */
import { PAGE_DEFAULT_TAB } from './pageNavigation';

export type ManifestStorageKey = string & { readonly __manifestStorageKey: unique symbol };

const asManifestKey = (key: string): ManifestStorageKey => key as ManifestStorageKey;

export type StorageNamespace = 'mineo' | 'minprocesrente';

let storageNamespace: StorageNamespace | null = null;

/**
 * Sæt storage-namespace for hele app-varianten. Skal kaldes ÉN gang ved bootstrap,
 * før nogen sessionStorage-adgang. Idempotent for samme værdi.
 */
export const setStorageNamespace = (namespace: StorageNamespace): void => {
  if (storageNamespace !== null && storageNamespace !== namespace) {
    throw new Error(
      `Storage-namespace er allerede låst til "${storageNamespace}" og kan ikke ændres til "${namespace}".`
    );
  }
  storageNamespace = namespace;
};

const resolveStorageNamespace = (): StorageNamespace => {
  // Mineo er fail-safe default for isolerede domæne-/testkald, men begge produktionsentries
  // låser deres variant eksplicit før App-grafen evalueres.
  storageNamespace ??= 'mineo';
  return storageNamespace;
};

export const getStorageNamespace = (): StorageNamespace => resolveStorageNamespace();

const ns = (suffix: string): string => `${resolveStorageNamespace()}_${suffix}`;

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
 * Reset-policyen: hvilke manifest-ejede UI-nøgler `Slet alt` skal
 * rydde. Klassifikationen bor HER, i manifestet, fordi den er en egenskab ved nøglen – ikke ved den use-case,
 * der tilfældigvis kalder `Slet alt`. En ny nøgle tvinges til at vælge side af `SESSION_RESET_POLICY`, og
 * `Slet alt` enumererer klassifikationen frem for at gentage en håndskrevet liste.
 *
 * `caseScoped`: sagsnær tilstand – brugerindtastede hjælpeværdier og filnavns-/filhåndtags-metadata, der hører
 * til PRÆCIS den sag, der slettes. Overlever den ikke en bekræftet hel-sags-clear, kan den hydrere ind i den
 * næste, tomme sag og påvirke den (fundets konkrete symptom).
 *
 * `deviceScoped`: uafhængig UI-præference eller devtools-tilstand, som ikke beskriver sagen. Ryddes bevidst
 * IKKE – kontraktens §3.7 holder den uden for inputenvelopen, og en bruger, der sletter sin sag, har ikke
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
 * De sagsnære nøgler, `Slet alt` skal rydde – i deklarationsrækkefølge, resolveret mod det AKTUELLE namespace.
 * En aktiv fane beskriver den aktuelle sag, selv om den ikke er en del af sagsinputtet: efter `Slet alt` skal
 * hver fagside derfor starte på sin standardfane. Familie-medlemmerne udledes af `PAGE_DEFAULT_TAB`, så en ny
 * side med persisteret fanevalg automatisk bliver omfattet af reset-policyen.
 */
export const getCaseScopedSessionStorageKeys = (): readonly ManifestStorageKey[] =>
  [
    ...(Object.keys(SESSION_RESET_POLICY) as (keyof typeof SESSION_RESET_POLICY)[])
      .filter((name) => SESSION_RESET_POLICY[name] === 'caseScoped')
      .map((name) => asManifestKey(ns(UI_STORAGE_KEY_SUFFIXES[name]))),
    ...Object.keys(PAGE_DEFAULT_TAB).map((pageId) => createActiveTabStorageKey(pageId)),
  ];

/**
 * Den ENESTE sessionStorage-nøgle for sagsinput (draft/commit-designet §2.1.6/§3.7): hele det
 * afsluttede inputaggregat ligger i én envelope under denne nøgle.
 *
 * Sektionsopdelt sessionpersistering og en parallel recovery-kanal må ikke genindføres; hele det
 * afsluttede aggregat har én skrivegrænse, jf. `persistence-contract.md`. Sektions-BEGREBET lever videre som
 * `PERSISTED_SECTION_KEYS` i `persistenceRegistry.ts`, som er den ene kilde til hvilke sektioner
 * en `.eo`-fil indeholder.
 */
const CURRENT_INPUT_ENVELOPE_SUFFIX = 'input_v2';

/**
 * Løkkeværn for opstartens versions-reload (`serviceWorkerBootstrap`). Nøglen holder den udrullede
 * version, der SIDST udløste et automatisk reload i denne session.
 *
 * Værnet er ikke pyntelig defensivitet: opstarten genindlæser, når den udrullede build afviger fra
 * dokumentets egen. Er den observerede version allerede noteret her, må der ikke reloades igen –
 * ellers ville en fejlagtig eller uophørligt skiftende versionsangivelse sende programmet i en
 * genindlæsningsløkke, som er værre end den forældede kode, den skulle rette.
 *
 * Nøglen er `deviceScoped` af natur (den beskriver ikke sagen) og indgår derfor ikke i
 * `SESSION_RESET_POLICY`: den hører ikke til UI-familien, som `Slet alt` enumererer.
 */
const BOOT_RELOAD_VERSION_SUFFIX = 'pwa_bootReloadVersion';

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

/** Nøgle til opstartens versions-reload-løkkeværn. Namespace-aware og dovent resolveret. */
export const getBootReloadVersionStorageKey = (): ManifestStorageKey =>
  asManifestKey(ns(BOOT_RELOAD_VERSION_SUFFIX));

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
    || key === ns(BOOT_RELOAD_VERSION_SUFFIX)
    || key.startsWith(ns(ACTIVE_TAB_SUFFIX_PREFIX));
};
