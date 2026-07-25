import type { EoFileData } from '../schemas/eoFileSchema';
import type { PersistedSectionsSnapshot } from '../config/persistenceRegistry';

/**
 * Autoritativt snapshot fra persistence-laget.
 *
 * Semantik:
 * - Skal indeholde alle `PersistedSectionKey`s (brug `undefined` for at udelade en sektion).
 * - Må ikke indeholde `null` (fail-fast; ellers risikerer vi silent data loss).
 */
export type SaveSnapshot = PersistedSectionsSnapshot;

/**
 * Canonical `.eo` payload representation.
 *
 * VIGTIGT (trust-critical):
 * - Denne repræsentation er den ENESTE autoritative sandhed for save/verify.
 * - Alt der gemmes skal valideres til denne type via `eoFileDataSchema`.
 */
export type CanonicalEoData = EoFileData;

export type VerificationFailureKind = 'unusable' | 'integrity';

export type VerificationResult = {
  success: boolean;
  kind?: VerificationFailureKind;
  verified?: boolean;
  warning?: boolean;
  message?: string;
  error?: string;
  details?: string;
  differences?: string[];
};
