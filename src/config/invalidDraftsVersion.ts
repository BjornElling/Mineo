/**
 * Selvstændig version for envelopen med afsluttede ugyldige input.
 *
 * Versionen må ikke kobles til `PERSISTED_DATA_VERSION`: den versionerer canonical sagssektioner,
 * mens denne envelope versionerer feltadresser og recovery-format. Et fremtidigt feltadresseskift
 * skal have en eksplicit migration, så synligt ugyldigt input aldrig droppes ved en almindelig
 * schemaændring i sagsdata.
 */
export const INVALID_DRAFTS_ENVELOPE_VERSION = 'invalid-drafts-v1';

/**
 * Før envelopen fik sin egen version, bar den den samtidige `PERSISTED_DATA_VERSION` (fx `3.8`).
 * De numeriske legacy-versioner har samme validerede payloadform og kan derfor migreres tabsfrit
 * ved læsning. Nye envelope-versioner bruger det navngivne prefix ovenfor og accepteres ikke her.
 */
export const isLegacyInvalidDraftsEnvelopeVersion = (version: string): boolean =>
  /^\d+\.\d+$/.test(version);
