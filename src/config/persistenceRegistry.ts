import { z } from 'zod';
import {
  aarsloenSchema,
  faellesAarsloenSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  satserSchema,
  stamdataSchema,
  varigeMenSchema,
  erhvervsevnetabSchema,
  forsoergertabSchema,
} from '../schemas/formSchemas';

/**
 * Den ENE kilde til hvilke persisterede sagssektioner der findes, og hvilket schema hver af dem
 * parses med. Både `.eo`-filens struktur (`eoFileSchema`) og session-hydreringen udleder deres
 * sektionsmængde herfra — så de to veje aldrig kan drifte fra hinanden og tavst tabe en sektion.
 *
 * Sektionsmængden var tidligere også udtrykt som per-sektion-sessionStorage-nøgler i
 * `storageManifest.ts`. Den nøglefamilie er slettet (greenfield trin 13): sagsinput ligger i ÉN
 * envelope, og sektionsopdelingen er alene en dataform, ikke en skrivegrænse.
 */
export const persistenceSchemas = {
  stamdata: stamdataSchema,
  satser: satserSchema,
  aarsloen: aarsloenSchema,
  faellesAarsloen: faellesAarsloenSchema,
  renteberegning: renteberegningSchema,
  varigemen: varigeMenSchema,
  forsoergertab: forsoergertabSchema,
  erstatningsopgoerelse: erstatningsopgoerelseSchema,
  erhvervsevnetab: erhvervsevnetabSchema,
} as const satisfies Record<string, z.ZodTypeAny>;

/**
 * Logisk sagssektions-nøgle (fx `'stamdata'`). Afledt af `persistenceSchemas`, så en ny sektion
 * kun kan tilføjes ét sted.
 *
 * BEMÆRK navnet: dette er en SEKTION i en `.eo`-fil, ikke en sessionStorage-nøgle. De to begreber
 * var sammenblandet, så længe hver sektion havde sin egen storage-nøgle; det gør de ikke længere
 * (sagsinput ligger i ÉN envelope). `ManifestStorageKey` i `storageManifest.ts` er det andet
 * begreb — en konkret browserlager-nøgle — og de må ikke forveksles igen.
 */
export type PersistedSectionKey = keyof typeof persistenceSchemas;

/**
 * Frosset med vilje: listen er den autoritative sektionsmængde for både save og load, og
 * `fileLoad` bruger den både til optælling og til behandling. En consumer, der kunne `push`/`splice`
 * i den, ville ændre begge på én gang — dvs. tavst datatab.
 */
export const PERSISTED_SECTION_KEYS: readonly PersistedSectionKey[] = Object.freeze(
  Object.keys(persistenceSchemas) as PersistedSectionKey[]
);

export type PersistedSectionMap = {
  [K in keyof typeof persistenceSchemas]: z.infer<(typeof persistenceSchemas)[K]>;
};

export type PersistedSectionsSnapshot = {
  [K in PersistedSectionKey]: PersistedSectionMap[K] | undefined;
};

export type HydratedPersistedSectionsSnapshot = {
  [K in PersistedSectionKey]: PersistedSectionMap[K] | null;
};
