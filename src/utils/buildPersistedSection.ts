import type { z } from 'zod';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { PersistedSectionKey } from '../config/persistenceRegistry';
import type { PersistedData } from '../types/persistence';
import { nullToUndefinedDeep } from './nullToUndefinedDeep';
import { serializeFormValues } from './serialization';

export type PersistedSectionBuildResult<K extends PersistedSectionKey> =
  | {
      ok: true;
      /** Serialiseret + re-valideret sektionsdata (reload-ækvivalent), klar til store-commit. */
      validatedData: PersistedSectionMap[K];
      /** Fuld PersistedData-konvolut ({ version, timestamp, data }). */
      persistedData: PersistedData;
      /** JSON.stringify(persistedData) — klar til sessionStorage. */
      serialized: string;
    }
  | {
      ok: false;
      /** Hvilket trin der fejlede; bestemmer caller'ens fejl-ordlyd og om der vises zod-issues. */
      stage: 'config' | 'schema' | 'post-serialize';
      /** Zod-fejlen for schema/post-serialize-trin (undefined for 'config'). */
      error?: z.ZodError;
    };

/**
 * Det ENESTE sted der bygger en persisteret sektion fra rå (committed eller indkommende) data.
 *
 * Kører den trust-kritiske kæde:
 *   nullToUndefinedDeep → schema-validér → serialiser → re-validér (reload-ækvivalens-invarianten)
 *   → pak i { version, timestamp, data }.
 *
 * De tidligere sektionsvise gem-stier byggede oprindeligt kæden hver for sig med subtilt forskellig
 * og dermed drift-udsat kode. Fase 3 bruger helperen ved kompatibilitetsgrænsen, før hele inputaggregatet
 * skrives af transaktionsrunneren. Fejlordlyden ejes fortsat af caller via `stage` og `error`.
 *
 * `timestamp` gives af caller, så loop-stier kan stemple alle sektioner med ét fælles Date.now().
 */
export const buildPersistedSection = <K extends PersistedSectionKey>(
  pageKey: K,
  data: PersistedSectionMap[K],
  timestamp: number
): PersistedSectionBuildResult<K> => {
  // Defensivt: persistenceSchemas er nøglet på PersistedSectionKey, men hot-reload/delvis modul-state under
  // udvikling kan teoretisk efterlade nøglen manglende.
  if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, pageKey)) {
    return { ok: false, stage: 'config' };
  }

  const schema = persistenceSchemas[pageKey];
  const validated = schema.safeParse(nullToUndefinedDeep(data));
  if (!validated.success) {
    return { ok: false, stage: 'schema', error: validated.error };
  }

  const persistedSectionData = serializeFormValues(validated.data);
  // Trust-kritisk invariant: cachen skal matche repræsentationen efter serialisering (reload-ækvivalent).
  const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
  if (!postSerializeValidated.success) {
    return { ok: false, stage: 'post-serialize', error: postSerializeValidated.error };
  }

  const persistedData: PersistedData = {
    version: PERSISTED_DATA_VERSION,
    timestamp,
    data: persistedSectionData,
  };

  return {
    ok: true,
    validatedData: postSerializeValidated.data as PersistedSectionMap[K],
    persistedData,
    serialized: JSON.stringify(persistedData),
  };
};
