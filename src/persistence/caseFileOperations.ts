import {
  PERSISTED_SECTION_KEYS,
  type PersistedSectionsSnapshot,
} from '../config/persistenceRegistry';
import type { EvaluationSourceToken } from '../inputCore/evaluationSource';
import type { InputCatalog } from '../inputCore/fieldCatalog';
import type { SettledInput, SettledInputCandidate } from '../inputCore/settledInput';
import { replaceCase } from '../inputCore/inputReducer';
import { countFilledFields } from '../utils/dataCollection';
import { projectEoSave, type EoSaveProjection } from './eoSaveProjection';

// Greenfield-runtime (§3.10): `CaseFileOperations`-porten ejer `.eo`-save (via `projectEoSave`) og
// load-apply over reader-/replacement-grænserne. Den er materielt forskellig fra den legacy
// `FormPersistenceContext`: den eksponerer HVERKEN rå sektioner, rejected maps, `fieldErrors` eller
// notices. Den læser kun det afsluttede input gennem en injiceret kildeoptager og skriver kun gennem
// den ene autoritative `replaceCase`-command. UI-flow (preflight-dialog, overwrite-gate, PWA-samtidighed,
// fokusrestore) og selve fil-I/O'et (`saveToFile`/`loadFromFile`, codec, metadata) ejes fortsat af
// shell-use-casen og de bevarede `utils/file*`-primitiver (§4.1); porten binder dem til greenfield-runtime.

/**
 * Den minimale runtime-grænse porten har brug for. Injiceres (ikke den fulde binding), så porten er
 * framework-fri og testbar uden React: den kan hverken læse rå sektioner uden om reader-grænsen eller
 * udstede felt-scopede commands.
 */
export type CaseRuntimeAccess = Readonly<{
  catalog: InputCatalog;
  /** Det aktuelle afsluttede input (til `.eo`-save-projektionen og `hasAnyData`). */
  getSettledInput: () => SettledInput;
  /**
   * Optager et FRISKT, stabilt kildesnapshot til `.eo`-save (§3.9 pkt. 2): efter settle læses input +
   * token samlet, så save-projektionen evalueres mod præcis den revision, der skrives.
   */
  captureSaveSource: () => Readonly<{ input: SettledInput; token: EvaluationSourceToken }>;
  /**
   * Anvender et indlæst snapshot som ÉN autoritativ hel-sags-replacement (`replaceCase`), der rydder
   * history og flytter `replacementGeneration` (§3.7). Kaster ved schema-/katalogafvisning.
   */
  applyReplaceCase: (candidate: SettledInputCandidate) => void;
}>;

export type EoSaveOutcome =
  | Readonly<{ status: 'ready'; snapshot: PersistedSectionsSnapshot; token: EvaluationSourceToken }>
  | Readonly<{ status: 'blocked'; rejectedAddresses: readonly string[] }>;

/**
 * Bygger et load-apply-kandidat fra et schema-gyldigt `.eo`-snapshot. Et indlæst `.eo` er altid canonical
 * (rejected råtekst serialiseres aldrig til fil, §1.6), så `rejectedInputs` er tomt. Snapshotets `undefined`-
 * sektioner mappes til `null`, fordi den afsluttede inputtilstand bruger `null` for en tom sektion (§3.1).
 */
export const buildLoadReplaceCaseCandidate = (
  snapshot: PersistedSectionsSnapshot
): SettledInputCandidate => Object.freeze({
  sections: Object.fromEntries(
    PERSISTED_SECTION_KEYS.map((section) => [section, snapshot[section] ?? null])
  ) as SettledInputCandidate['sections'],
  rejectedInputs: {},
});

/**
 * Porten. En tynd, ren orkestrering oven på `CaseRuntimeAccess`: den kobler den bevarede fil-I/O til
 * greenfield-runtime uden at eksponere en ny altomfattende facade (§3.10).
 */
export type CaseFileOperations = Readonly<{
  /**
   * Evaluerer `.eo`-save (§3.9): optager frisk kilde, kører `projectEoSave` og returnerer enten det
   * schema-parsede canonical snapshot + kildetoken (klar til `saveToFile`) eller de blokerende rejected
   * adresser. Selve fil-skrivningen og settle-før-save ligger i use-casen (contract §2/§6).
   */
  evaluateSave: () => EoSaveOutcome;
  /** Anvender et indlæst, pre-valideret `.eo`-snapshot atomisk gennem replacement-grænsen. */
  applyLoadedSnapshot: (snapshot: PersistedSectionsSnapshot) => void;
  /** Om sagen indeholder brugerdata (til overwrite-gaten ved load), læst fra afsluttet input uden raw-bypass. */
  hasAnyData: () => boolean;
}>;

export const createCaseFileOperations = (runtime: CaseRuntimeAccess): CaseFileOperations => Object.freeze({
  evaluateSave: (): EoSaveOutcome => {
    const { input, token } = runtime.captureSaveSource();
    const projection: EoSaveProjection = projectEoSave(input, runtime.catalog);
    if (projection.status === 'blocked') {
      return Object.freeze({ status: 'blocked', rejectedAddresses: projection.rejectedAddresses });
    }
    return Object.freeze({ status: 'ready', snapshot: projection.snapshot, token });
  },

  applyLoadedSnapshot: (snapshot): void => {
    runtime.applyReplaceCase(buildLoadReplaceCaseCandidate(snapshot));
  },

  hasAnyData: (): boolean => settledInputHasAnyData(runtime.getSettledInput()),
});

/**
 * Afgør om sagen indeholder brugerdata. Tæller BÅDE canonical meningsfulde felter OG et ikke-tomt
 * `rejectedInputs` (§1.6): et rejected-only felt (tomt canonical slot + bevaret fejlende råtekst) er stadig
 * afsluttet brugerinput. Ellers ville en load kunne overskrive et afsluttet fejlende felt uden overwrite-
 * bekræftelse. Dette er den ene data-presence-forespørgsel; consumers får resultatet, ikke rå sections (§5.4).
 */
export const settledInputHasAnyData = (input: SettledInput): boolean =>
  countFilledFields(input.sections) > 0 || Object.keys(input.rejectedInputs).length > 0;

/** Hjælper til use-casen: `replaceCase`-command fra et allerede validerbart kandidat. */
export const loadReplaceCaseCommand = (snapshot: PersistedSectionsSnapshot) =>
  replaceCase(buildLoadReplaceCaseCandidate(snapshot));
