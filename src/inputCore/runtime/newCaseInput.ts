import type { InputCatalog } from '../fieldCatalog';
import { buildNewCaseSections, type NewCaseSeed } from '../newCaseSections';
import type { SettledInput } from '../settledInput';
import { parseCurrentEnvelope, serializeCurrentEnvelope } from './currentSessionEnvelope';

// Input-runtime (§1.12): den ENE konstruktion af "en helt ny sag" som færdigt, valideret `SettledInput`.
// Bruges af bootstrap-hydrationen (`initializeInputRuntime`) og som den baseline, `hasAnyData` måler
// brugerdata imod. `clearCase` når samme værdi ad kommando-vejen, fordi reduceren bygger sine sektioner med
// den samme `buildNewCaseSections`.

/**
 * Bygger den nye sags autoritative inputtilstand.
 *
 * Resultatet er ROUND-TRIPPET gennem envelope-serialiseringen, præcis som `dispatchInput` gør det for enhver
 * commit. Det er ikke kosmetik: JSON dropper `undefined`-nøgler, så en ikke-round-trippet baseline ville være
 * strukturelt forskellig fra den samme sag efter et `Slet alt` eller en F5 – og enhver sammenligning mod
 * baselinen ville svare "der er brugerdata" på en urørt sag.
 */
export const createNewCaseInput = (catalog: InputCatalog, seed?: NewCaseSeed): SettledInput => {
  const candidate = catalog.validateSettledInput({
    sections: buildNewCaseSections(seed),
    rejectedInputs: {},
  });
  return catalog.validateSettledInput(parseCurrentEnvelope(serializeCurrentEnvelope(candidate)));
};
