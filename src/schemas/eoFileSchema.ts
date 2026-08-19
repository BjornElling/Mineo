/**
 * Zod-schemas for `.eo`-filers payloads.
 *
 * VIGTIGT:
 * - `.eo` filer må kun indeholde schema-defineret brugerinput (ingen derived/UI state).
 * - Save er strict; load er best-effort pr. sektion med preflight ved delvis import.
 */

import { z } from 'zod';
import { FILE_FORMAT_VERSION } from '../config/version';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';

/**
 * Rod-datastruktur inde i den dekrypterede `.eo`-fil.
 *
 * Nøglesæt OG per-sektion-schema udledes fra `persistenceSchemas` (ÉN sandhedskilde,
 * jf. `PersistedSectionKey`), så `.eo`-payloaden aldrig kan drive fra de persisterede sektioner –
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
 * Container-metadata. Save kræver den aktuelle sagsdataversion; load accepterer
 * fraværende/andre versioner, så kildeversionen kan håndteres tolerant downstream.
 */
const eoFileMetadataBaseShape = {
  exportDate: z.string(),
  appVersion: z.string(),
  fieldCount: z.number().int().nonnegative(),
} as const;

const eoFileMetadataSchema = z.object({
  ...eoFileMetadataBaseShape,
  persistedDataVersion: z.literal(PERSISTED_DATA_VERSION),
});

const eoFileMetadataLoadSchema = z.object({
  ...eoFileMetadataBaseShape,
  persistedDataVersion: z.string().trim().min(1).optional(),
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
 * NOTE: `.strict()` på container-niveau er bevidst – container-strukturen er fast og
 * versionsstyret. Nye top-level felter kræver en bevidst migrering af dette schema.
 * Permissiviteten er afgrænset til `data`-sektionen og `_metadata`-felternes indhold.
 */
export const eoFileContainerLoadSchema = z.object({
  version: z.literal(FILE_FORMAT_VERSION),
  _metadata: eoFileMetadataLoadSchema,
  data: eoFileDataLoadSchema,
}).strict();

export type EoFileContainerLoad = z.infer<typeof eoFileContainerLoadSchema>;
