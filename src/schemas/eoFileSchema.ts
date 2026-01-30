/**
 * Zod schemas for `.eo` file payloads.
 *
 * VIGTIGT:
 * - `.eo` filer må kun indeholde schema-defineret brugerinput (ingen derived/UI state).
 * - Validering skal være fail-fast: hvis data ikke matcher schemas, må intet indlæses.
 */

import { z } from 'zod';
import {
  aarsloenSchema,
  erstatningsopgoerelseSchema,
  renteberegningSchema,
  satserSchema,
  stamdataSchema,
  varigeMenSchema,
} from './formSchemas';

/**
 * Deep-converts `null` -> `undefined` recursively.
 *
 * Rationale:
 * - sessionStorage persistence uses JSON, where `undefined` becomes `null`
 * - our Zod schemas model optional fields as `undefined` (not `null`)
 * - `.eo` files are saved from the sessionStorage representation
 *
 * This preprocessing keeps save/load strict and fail-fast, while accepting the
 * JSON-null representation of optional fields.
 */
const nullToUndefinedDeep = (value: unknown): unknown => {
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

/**
 * Root data structure inside decrypted `.eo` file.
 *
 * NOTE: keys matches `StorageKey` (see `src/config/storageManifest.ts`).
 */
const eoFileDataInnerSchema = z.object({
  stamdata: stamdataSchema.optional(),
  satser: satserSchema.optional(),
  varigemen: varigeMenSchema.optional(),
  aarsloen: aarsloenSchema.optional(),
  renteberegning: renteberegningSchema.optional(),
  erstatningsopgoerelse: erstatningsopgoerelseSchema.optional(),
}).strict();

export const eoFileDataSchema = z.preprocess(nullToUndefinedDeep, eoFileDataInnerSchema);

export type EoFileData = z.infer<typeof eoFileDataSchema>;

/**
 * Load-only schema: accepts unknown sections and unknown fields inside sections.
 *
 * Rationale (trust-critical):
 * - Old files may contain fields/sections that no longer exist; we must be able to load the rest,
 *   while reporting exactly what could not be loaded.
 * - New fields added since save-time will be missing; they must not block load.
 *
 * NOTE: This schema does NOT validate section content. Content is validated/sanitized
 * in `src/utils/fileLoad.ts` with strict per-section schemas.
 */
const eoFileDataLoadInnerSchema = z.object({
  stamdata: z.unknown().optional(),
  satser: z.unknown().optional(),
  varigemen: z.unknown().optional(),
  aarsloen: z.unknown().optional(),
  renteberegning: z.unknown().optional(),
  erstatningsopgoerelse: z.unknown().optional(),
}).passthrough();

export const eoFileDataLoadSchema = z.preprocess(nullToUndefinedDeep, eoFileDataLoadInnerSchema);

export type EoFileDataLoad = z.infer<typeof eoFileDataLoadSchema>;

/**
 * Full decrypted `.eo` container before encryption.
 */
export const eoFileContainerSchema = z.object({
  version: z.string(),
  _metadata: z.object({
    exportDate: z.string(),
    appVersion: z.string(),
    fieldCount: z.number().int().nonnegative(),
    schemaHash: z.string().optional(),
  }).optional(),
  data: eoFileDataSchema,
}).strict();

export type EoFileContainer = z.infer<typeof eoFileContainerSchema>;

/**
 * Load-only container schema.
 *
 * Allows unknown sections in `data` so we can report them without blocking load.
 */
export const eoFileContainerLoadSchema = z.object({
  version: z.string(),
  _metadata: z.object({
    exportDate: z.string(),
    appVersion: z.string(),
    fieldCount: z.number().int().nonnegative(),
    schemaHash: z.string().optional(),
  }).optional(),
  data: eoFileDataLoadSchema,
}).strict();

export type EoFileContainerLoad = z.infer<typeof eoFileContainerLoadSchema>;
