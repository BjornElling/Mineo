/**
 * `EoFileCodec` – grænsen mellem en `.eo`-fils bytes (krypteret streng) og den validerede
 * container-model. Al load-inbound-afkodning af en `.eo`-fil går gennem dette modul.
 *
 * - `buildEoFileContainer` + `encodeEoFile` er outbound-siden (save): stempl metadata → krypter.
 * - `decodeEoFile` er inbound-siden (load): dekrypter → versionstjek → load-tolerant validering.
 *
 * Bemærk: save-sidens read-back-verifikation (`verifyAfterSave` i `fileSaveInternals.ts`) er en
 * SEPARAT, bevidst strikt integritetskontrol – den dekrypterer de skrevne bytes og re-parser mod
 * det STRIKTE container-schema for at bevise, at artefaktet tro koder den kanoniske save-data.
 * Den kører med vilje IKKE denne load-tolerante/migrerende afkodning (som netop transformerer på
 * tværs af versioner). De to concerns deler ikke grænse.
 *
 * `decodeEoFile` blev tidligere håndrullet identisk i både `loadFromFile` og `loadFromFileHandle`
 * (decrypt-try/catch + `normalizeDecryptedContainer`). Samme rå bytes skal altid afkodes ens,
 * uanset om kilden er en manuel picker eller en persisteret PWA-handle – derfor er afkodningen
 * samlet her. Selve per-sektions-parsingen + preflight ejes stadig af load-use-casen (`fileLoad.ts`),
 * ikke af codec'en: codec'en leverer den validerede container, ikke det anvendte snapshot.
 */

import { VERSION } from '../config/buildInfo';
import { FILE_FORMAT_VERSION } from '../config/version';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import {
  decryptFromString,
  EncryptionError,
  encryptToString,
} from './encryption';
import { logError } from './logger';
import { CalculationError } from './errorMessages';
import {
  eoFileContainerLoadSchema,
  type EoFileContainer,
  type EoFileContainerLoad,
} from '../schemas/eoFileSchema';
import type { CanonicalEoData } from './fileSaveTypes';
import { formatZodIssues } from './zodIssueFormatting';
import { isRecord } from './typeGuards';

/**
 * Bygger den kanoniske `.eo`-container: stempler container-version + metadata omkring den
 * allerede schema-validerede sagsdata. `fieldCount` leveres af save-use-casen (den bruger samme
 * tal til preflight-rapportering og gating), så det ikke genberegnes to steder.
 */
export const buildEoFileContainer = (
  data: CanonicalEoData,
  fieldCount: number
): EoFileContainer => ({
  version: FILE_FORMAT_VERSION,
  _metadata: {
    exportDate: new Date().toISOString(),
    appVersion: VERSION,
    persistedDataVersion: PERSISTED_DATA_VERSION,
    fieldCount,
  },
  data,
});

/** Krypterer containeren til den `.eo`-fil-streng, der skrives til disk/download. */
export const encodeEoFile = (container: EoFileContainer): Promise<string> =>
  encryptToString(container);

/**
 * Validerer en dekrypteret container mod det load-tolerante schema.
 *
 * Versionsfeltet tjekkes eksplicit FØR Zod-parse, så en forkert/manglende/ikke-streng version giver
 * en klar dansk versionsfejl (kontrakt §7) frem for den generiske "ugyldig .eo-struktur".
 */
const validateDecryptedContainer = (decrypted: unknown): EoFileContainerLoad => {
  if (!isRecord(decrypted)) {
    throw new Error('Ugyldig fil-struktur (ikke et objekt)');
  }

  const rawVersion = decrypted.version;
  if (typeof rawVersion !== 'string' || rawVersion !== FILE_FORMAT_VERSION) {
    throw new Error(`Ugyldig eller manglende filversion. Forventet format ${FILE_FORMAT_VERSION}.`);
  }

  const parsed = eoFileContainerLoadSchema.safeParse(decrypted);
  if (!parsed.success) {
    const issues = formatZodIssues(parsed.error.issues, 3);
    const suffix = issues.trim() !== '' ? `\n\nDetaljer (første 3):\n${issues}` : '';
    throw new Error(
      'Filen har ugyldig .eo-struktur og kan derfor ikke indlæses.\n' +
      `Filen er sandsynligvis korrupt eller ikke opbygget som en gyldig Mineo-fil.${suffix}`
    );
  }

  return parsed.data;
};

/**
 * Dekrypterer og validerer en `.eo`-fil-streng til den load-tolerante container.
 *
 * Fejl-semantik (bevaret fra de tidligere håndrullede load-stier):
 * - `EncryptionError` (forkert nøgle/korrupt payload) mappes til `CalculationError('FILE_LOAD_FAILED')`,
 *   som load-use-casen kender og viser som en forventet, brugervenlig fejl.
 * - Andre dekrypteringsfejl logges og genkastes med en dansk besked.
 * - Struktur-/versionsfejl kastes med de eksplicitte danske beskeder fra `validateDecryptedContainer`.
 */
export const decodeEoFile = async (content: string): Promise<EoFileContainerLoad> => {
  let decrypted: unknown;
  try {
    decrypted = await decryptFromString(content);
  } catch (error: unknown) {
    if (error instanceof EncryptionError) {
      throw new CalculationError('FILE_LOAD_FAILED', { cause: error });
    }
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    logError('Dekryptering fejlede', {
      context: 'eoFileCodec.decode',
      error: error instanceof Error ? error : undefined,
    });
    throw new Error(`Kunne ikke dekryptere fil: ${message}`, { cause: error });
  }

  return validateDecryptedContainer(decrypted);
};
