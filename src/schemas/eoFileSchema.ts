/**
 * Zod-schemas for `.eo`-filers payloads.
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
 * Rod-datastruktur inde i den dekrypterede `.eo`-fil.
 *
 * Nøglesæt OG per-sektion-schema udledes fra `persistenceSchemas` (ÉN sandhedskilde,
 * jf. `StorageKey`), så `.eo`-payloaden aldrig kan drive fra de persisterede sektioner —
 * en ny/fjernet sektion forplanter sig automatisk hertil. Hver sektion er `.optional()`
 * (delvis import understøttes), og objektet er `.strict()`.
 */
type EoFileDataInnerShape = {
  [K in keyof typeof persistenceSchemas]: z.ZodOptional<(typeof persistenceSchemas)[K]>;
};

const eoFileDataInnerShape = Object.fromEntries(
  (Object.keys(persistenceSchemas) as (keyof typeof persistenceSchemas)[]).map(
    (key) => [key, persistenceSchemas[key].optional()] as const
  )
) as EoFileDataInnerShape;

const eoFileDataInnerSchema = z.object(eoFileDataInnerShape).strict();

export const eoFileDataSchema = z.preprocess(nullToUndefinedDeep, eoFileDataInnerSchema);

export type EoFileData = z.infer<typeof eoFileDataSchema>;

/**
 * Load-only data-schema.
 *
 * Accepterer alle sektioner som unknown så load-pipelinen kan validere kendte sektioner
 * enkeltvis og rapportere ukendte felter/sektioner i preflight.
 */
export const eoFileDataLoadSchema = z.preprocess(nullToUndefinedDeep, z.looseObject({}));


/**
 * Container-metadata. Identisk for save- og load-schemaerne: kun `data`-permissiviteten
 * adskiller dem (se `eoFileContainerLoadSchema`).
 */
const eoFileMetadataSchema = z.object({
  exportDate: z.string(),
  appVersion: z.string(),
  fieldCount: z.number().int().nonnegative(),
});

/**
 * Fuld dekrypteret `.eo`-container.
 */
export const eoFileContainerSchema = z.object({
  version: z.literal(FILE_FORMAT_VERSION),
  _metadata: eoFileMetadataSchema,
  data: eoFileDataSchema,
}).strict();

export type EoFileContainer = z.infer<typeof eoFileContainerSchema>;

/**
 * Load-only dekrypteret `.eo`-container.
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
  _metadata: eoFileMetadataSchema,
  data: eoFileDataLoadSchema,
}).strict();

export type EoFileContainerLoad = z.infer<typeof eoFileContainerLoadSchema>;
