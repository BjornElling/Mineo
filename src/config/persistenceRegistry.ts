import { z } from 'zod';
import type { StorageKey } from './storageManifest';
import {
  aarsloenSchema,
  faellesAarsloenSchema,
  faellesPersondataSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  satserSchema,
  stamdataSchema,
  varigeMenSchema,
  erhvervsevnetabSchema,
  forsoergertabSchema,
} from '../schemas/formSchemas';
import { computeSchemaFingerprint } from '../utils/schemaFingerprint';

export const persistenceSchemas = {
  stamdata: stamdataSchema,
  satser: satserSchema,
  aarsloen: aarsloenSchema,
  faellesAarsloen: faellesAarsloenSchema,
  faellesPersondata: faellesPersondataSchema,
  renteberegning: renteberegningSchema,
  varigemen: varigeMenSchema,
  forsoergertab: forsoergertabSchema,
  erstatningsopgoerelse: erstatningsopgoerelseSchema,
  erhvervsevnetab: erhvervsevnetabSchema,
} as const satisfies Record<StorageKey, z.ZodTypeAny>;

export const persistenceSchemaFingerprint = computeSchemaFingerprint(persistenceSchemas);

export type PersistedSectionMap = {
  [K in keyof typeof persistenceSchemas]: z.infer<(typeof persistenceSchemas)[K]>;
};

export type PersistedSection<K extends StorageKey> = PersistedSectionMap[K];
