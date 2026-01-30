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

export const nullToUndefinedDeep = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullToUndefinedDeep);
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = nullToUndefinedDeep(v);
    }
    return result;
  }
  return value;
};
