import { getCurrentInputEnvelopeStorageKey } from '../../config/storageManifest';
import { readSessionStorageValue } from '../../utils/safeSessionStorage';
import type { InputCatalog } from '../fieldCatalog';
import { createEmptySettledInput } from '../settledInput';
import { parseCurrentEnvelope } from './currentSessionEnvelope';
import type { SlimInputStore } from './slimInputStore';

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
  catalog: InputCatalog
): InputRuntimeStartup => {
  let raw: string | null;
  try {
    raw = readSessionStorageValue(getCurrentInputEnvelopeStorageKey());
  } catch {
    store.getState().hydrate(createEmptySettledInput(), { writesBlocked: true });
    return Object.freeze({ notice: UNAVAILABLE_NOTICE });
  }

  if (raw === null) {
    // Ingen aktiv session: normal førstegangs-load. Writes tilladt.
    store.getState().hydrate(createEmptySettledInput());
    return Object.freeze({ notice: null });
  }

  try {
    const input = catalog.validateSettledInput(parseCurrentEnvelope(raw));
    store.getState().hydrate(input);
    return Object.freeze({ notice: null });
  } catch {
    // Korruption i current-format: bevar rå envelope, blokér writes, vis systemfejl.
    store.getState().hydrate(createEmptySettledInput(), { writesBlocked: true });
    return Object.freeze({ notice: CORRUPTION_NOTICE });
  }
};
