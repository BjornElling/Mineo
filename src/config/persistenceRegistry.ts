import { z } from 'zod';
import type { StorageKey } from './storageManifest';
import {
  aarsloenSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  satserSchema,
  stamdataSchema,
  varigeMenSchema,
} from '../schemas/formSchemas';
import { computeSchemaFingerprint } from '../utils/schemaFingerprint';

export const persistenceSchemas = {
  stamdata: stamdataSchema,
  satser: satserSchema,
  aarsloen: aarsloenSchema,
  renteberegning: renteberegningSchema,
  varigemen: varigeMenSchema,
  erstatningsopgoerelse: erstatningsopgoerelseSchema,
} as const satisfies Record<StorageKey, z.ZodTypeAny>;

export const persistenceSchemaFingerprint = computeSchemaFingerprint(persistenceSchemas);

export type PersistedSectionMap = {
  [K in keyof typeof persistenceSchemas]: z.infer<(typeof persistenceSchemas)[K]>;
};

export type PersistedSection<K extends StorageKey> = PersistedSectionMap[K];
