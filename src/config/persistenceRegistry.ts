import { z } from 'zod';
import type { StorageKey } from './storageManifest';
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
} as const satisfies Record<StorageKey, z.ZodTypeAny>;

export const PERSISTED_SECTION_KEYS = Object.keys(persistenceSchemas) as StorageKey[];

export type PersistedSectionMap = {
  [K in keyof typeof persistenceSchemas]: z.infer<(typeof persistenceSchemas)[K]>;
};

export type PersistedSection<K extends StorageKey> = PersistedSectionMap[K];
