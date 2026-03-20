/**
 * Zod schemas for `.eo` file payloads.
 *
 * VIGTIGT:
 * - `.eo` filer må kun indeholde schema-defineret brugerinput (ingen derived/UI state).
 * - Save er strict; load er best-effort pr. sektion med preflight ved delvis import.
 */

import { z } from 'zod';
import { FILE_FORMAT_VERSION } from '../config/version';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';

/**
 * Root data structure inside decrypted `.eo` file.
 *
 * NOTE: keys matches `StorageKey` (see `src/config/storageManifest.ts`).
 */
const eoFileDataInnerSchema = z.object({
  stamdata: persistenceSchemas.stamdata.optional(),
  satser: persistenceSchemas.satser.optional(),
  aarsloen: persistenceSchemas.aarsloen.optional(),
  faellesAarsloen: persistenceSchemas.faellesAarsloen.optional(),
  faellesPersondata: persistenceSchemas.faellesPersondata.optional(),
  renteberegning: persistenceSchemas.renteberegning.optional(),
  varigemen: persistenceSchemas.varigemen.optional(),
  forsoergertab: persistenceSchemas.forsoergertab.optional(),
  erstatningsopgoerelse: persistenceSchemas.erstatningsopgoerelse.optional(),
  erhvervsevnetab: persistenceSchemas.erhvervsevnetab.optional(),
}).strict();

export const eoFileDataSchema = z.preprocess(nullToUndefinedDeep, eoFileDataInnerSchema);

export type EoFileData = z.infer<typeof eoFileDataSchema>;

/**
 * Load-only data schema.
 *
 * Accepterer alle sektioner som unknown så load-pipelinen kan validere kendte sektioner
 * enkeltvis og rapportere ukendte felter/sektioner i preflight.
 */
export const eoFileDataLoadSchema = z.preprocess(nullToUndefinedDeep, z.looseObject({}));


/**
 * Full decrypted `.eo` container.
 */
export const eoFileContainerSchema = z.object({
  version: z.literal(FILE_FORMAT_VERSION),
  _metadata: z.object({
    exportDate: z.string(),
    appVersion: z.string(),
    fieldCount: z.number().int().nonnegative(),
  }),
  data: eoFileDataSchema,
}).strict();

export type EoFileContainer = z.infer<typeof eoFileContainerSchema>;

/**
 * Load-only decrypted `.eo` container.
 *
 * Top-level container skal stadig have korrekt struktur, men `data` er permissiv så
 * kendte sektioner kan valideres enkeltvis.
 *
 * NOTE: `.strict()` på container-niveau er bevidst — container-strukturen er fast og
 * versionsstyret. Nye top-level felter kræver en bevidst migrering af dette schema.
 * Permissiviteten er afgrænset til `data`-sektionen og `_metadata`-felternes indhold.
 */
export const eoFileContainerLoadSchema = z.object({
  version: z.literal(FILE_FORMAT_VERSION),
  _metadata: z.object({
    exportDate: z.string(),
    appVersion: z.string(),
    fieldCount: z.number().int().nonnegative(),
  }),
  data: eoFileDataLoadSchema,
}).strict();

export type EoFileContainerLoad = z.infer<typeof eoFileContainerLoadSchema>;
