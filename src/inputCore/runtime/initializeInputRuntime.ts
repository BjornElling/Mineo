import { getCurrentInputEnvelopeStorageKey } from '../../config/storageManifest';
import { readSessionStorageValue } from '../../utils/safeSessionStorage';
import type { InputCatalog } from '../fieldCatalog';
import type { NewCaseSeed } from '../newCaseSections';
import { createEmptySettledInput } from '../settledInput';
import { parseCurrentEnvelope } from './currentSessionEnvelope';
import { createNewCaseInput } from './newCaseInput';
import type { SlimInputStore } from './slimInputStore';
import { hydrateInputStoreOnce } from './dispatchInput';

// Hydrér ÉN gang før React-render fra den ene current-only envelope (§3.10). Begge app-entrypoints
// kalder denne før render mod den samme runtime; provider-remount hydrerer aldrig igen.

export type InputRuntimeStartupNotice = Readonly<{
  message: string;
  type: 'warning' | 'error';
}>;

export type InputRuntimeStartup = Readonly<{
  notice: InputRuntimeStartupNotice | null;
}>;

/**
 * Valgfri engangs-seed af en HELT NY sag (§1.12). Anvendes KUN, når der ikke findes en aktiv session (`raw ===
 * null`) – aldrig oven på en indlæst eller korrupt kilde. Domænet leverer den; kernen er domæneneutral og
 * bruger kun resultatet som den hydrerede baseline (ingen ekstra revision eller history-frame).
 *
 * Typen og konstruktionen ejes af `src/inputCore/newCaseSections.ts`, fordi den SAMME seed også afgør, hvad
 * `Slet alt` genopretter, og hvad `hasAnyData` måler brugerdata imod.
 */
export type { NewCaseSeed };

export type InitializeInputRuntimeOptions = Readonly<{
  seedNewCase?: NewCaseSeed;
}>;

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
    // Ingen aktiv session: normal førstegangs-load. Writes tilladt. Den nye sag bygges HER af den ene
    // new-case-konstruktion (§1.12: eksplicit engangs-seed af en tom ny sag, aldrig en stille overskrivning).
    hydrateInputStoreOnce(store, catalog, createNewCaseInput(catalog, options.seedNewCase));
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
