import { getCurrentInputEnvelopeStorageKey } from '../../config/storageManifest';
import { readSessionStorageValue } from '../../utils/safeSessionStorage';
import type { InputCatalog } from '../fieldCatalog';
import { createEmptySettledInput, type SettledInput } from '../settledInput';
import { parseCurrentEnvelope } from './currentSessionEnvelope';
import type { SlimInputStore } from './slimInputStore';
import { hydrateInputStoreOnce } from './dispatchInput';

// Greenfield-runtime (§3.10): hydrér ÉN gang før React-render fra den ene current-only envelope. Ingen
// legacy-session-læsning, adresseoversættelse, dual-read eller kompatibilitetsdialog. Begge app-entrypoints
// kalder denne før render mod den samme runtime; provider-remount hydrerer aldrig igen.

export type InputRuntimeStartupNotice = Readonly<{
  message: string;
  type: 'warning' | 'error';
}>;

export type InputRuntimeStartup = Readonly<{
  notice: InputRuntimeStartupNotice | null;
}>;

/**
 * Valgfri engangs-seed af en HELT NY sag (§1.12). Kaldes KUN, når der ikke findes en aktiv session (`raw ===
 * null`) — aldrig oven på en indlæst eller korrupt kilde. Domænet leverer den (fx Satsers default-år); kernen
 * er domæneneutral og anvender kun resultatet som den hydrerede baseline (ingen ekstra revision/history-frame).
 * Resultatet valideres gennem `catalog.validateSettledInput`, så en seed aldrig kan bryde envelope-invarianterne.
 *
 * Signaturen giver bevidst IKKE domænet den rå `SettledInput` (R5-F02). Den gjorde det før, og seeden måtte
 * derfor spread'e `empty.sections` — altså udøve netop den rå-sektions-capability, `domain/raw-section-access-
 * boundary` erklærer, at kun `src/inputCore/` har. En seed skal kunne sige HVAD der seedes, ikke bygge
 * aggregatet: den returnerer en partial sektions-map, og kernen ejer konstruktionen og frysningen.
 * `undefined`/tom map betyder "seed intet".
 */
export type NewCaseSeed = () => Partial<SettledInput['sections']> | undefined;

export type InitializeInputRuntimeOptions = Readonly<{
  seedNewCase?: NewCaseSeed;
}>;

/**
 * Anvender en domæne-seeds sektionsværdier på den tomme baseline. Kernen ejer den rå sektions-konstruktion, så
 * en seed hverken kan fjerne en sektion, tilføje en ukendt nøgle eller røre `rejectedInputs` (§1.12).
 */
type SettledSections = SettledInput['sections'];

const assignSeededSection = <K extends keyof SettledSections>(
  target: { -readonly [P in keyof SettledSections]: SettledSections[P] },
  key: K,
  seeded: Partial<SettledSections>
): void => {
  const value = seeded[key];
  if (value === undefined || value === null) return;
  Object.freeze(value);
  target[key] = value;
};

const applyNewCaseSeed = (empty: SettledInput, seed: NewCaseSeed): SettledInput => {
  const seededSections = seed();
  if (seededSections === undefined) return empty;

  const keys = Object.keys(seededSections) as (keyof SettledSections)[];
  if (keys.length === 0) return empty;

  const sections = { ...empty.sections };
  for (const key of keys) assignSeededSection(sections, key, seededSections);
  return Object.freeze({ ...empty, sections: Object.freeze(sections) });
};

const CORRUPTION_NOTICE: InputRuntimeStartupNotice = Object.freeze({
  message: 'Gemte browserdata kunne ikke indlæses sikkert. For at beskytte dine data er ændringer låst, '
    + 'indtil du starter forfra med "Slet alt".',
  type: 'error',
});

const UNAVAILABLE_NOTICE: InputRuntimeStartupNotice = Object.freeze({
  message: 'Browserens midlertidige lager kunne ikke tilgås. Ændringer kan ikke gemmes i denne session.',
  type: 'error',
});

/**
 * Hydrerer runtime fra current-envelopen. Fail-closed (§1.12): ved korruption eller utilgængeligt lager bevares
 * den rå kilde UÆNDRET (vi skriver aldrig under hydration), runtime markeres `writesBlocked`, så normale writes
 * afvises af `dispatchInput`, og en systemfejl vises. Kun brugerens eksplicitte `Slet alt` kan rydde kilden.
 */
export const initializeInputRuntime = (
  store: SlimInputStore,
  catalog: InputCatalog,
  options: InitializeInputRuntimeOptions = {}
): InputRuntimeStartup => {
  let raw: string | null;
  try {
    raw = readSessionStorageValue(getCurrentInputEnvelopeStorageKey());
  } catch {
    hydrateInputStoreOnce(store, catalog, createEmptySettledInput(), { writesBlocked: true });
    return Object.freeze({ notice: UNAVAILABLE_NOTICE });
  }

  if (raw === null) {
    // Ingen aktiv session: normal førstegangs-load. Writes tilladt. En eventuel domæne-seed anvendes HER, som
    // den hydrerede baseline (§1.12: eksplicit engangs-seed af en tom ny sag, aldrig en stille overskrivning).
    const empty = createEmptySettledInput();
    const seeded = options.seedNewCase === undefined
      ? empty
      : catalog.validateSettledInput(applyNewCaseSeed(empty, options.seedNewCase));
    hydrateInputStoreOnce(store, catalog, seeded);
    return Object.freeze({ notice: null });
  }

  try {
    const input = catalog.validateSettledInput(parseCurrentEnvelope(raw));
    hydrateInputStoreOnce(store, catalog, input);
    return Object.freeze({ notice: null });
  } catch {
    // Korruption i current-format: bevar rå envelope, blokér writes, vis systemfejl.
    hydrateInputStoreOnce(store, catalog, createEmptySettledInput(), { writesBlocked: true });
    return Object.freeze({ notice: CORRUPTION_NOTICE });
  }
};
