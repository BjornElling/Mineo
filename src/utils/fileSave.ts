import { hasRealData, countFilledFields } from './dataCollection';
import { buildEoFileContainer, encodeEoFile } from './eoFileCodec';
import { downloadFile, type ResolvedDirectory } from './fileHelpers';
import {
  logError,
  logWarning,
} from './logger';
import { writeToFileHandle } from './fileSystemAccess';
import { saveFileHandleToIndexedDB } from './fileHandleStorage';
import type { SaveFileResult } from '../types/fileOperations';
import { eoFileDataSchema, type EoFileContainer } from '../schemas/eoFileSchema';
import type {
  CanonicalEoData,
  SaveSnapshot,
  VerificationFailureKind,
  VerificationResult,
} from './fileSaveTypes';
import {
  buildAllDataRawFromSnapshot,
  verifyAfterSave,
} from './fileSaveInternals';
import { asError } from './typeGuards';
import { applyRegisteredTableSaveOrder } from './tableSaveOrderRegistry';
import { persistSavedFilenameMetadata } from './filePersistenceMetadata';
import { resolveSaveTarget } from './fileSaveTarget';

export class SaveIntegrityError extends Error {
  readonly kind = 'integrity' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveIntegrityError';
  }
}

export class SaveUnusableFileError extends Error {
  readonly kind = 'unusable' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveUnusableFileError';
  }
}

export class SaveValidationError extends Error {
  readonly kind = 'validation' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveValidationError';
  }
}

/**
 * Brugervendte tekstvariationer i en verifikations-fejlbesked. Byggeriet af selve beskeden
 * (heading, detaljer, forskels-liste) var verbatim-dupleret i File System Access- og
 * fallback-grenen; kun disse tre tekster afveg. Helper'en samler konstruktionen ét sted, så
 * de to grene ikke driver fra hinanden, mens hver gren beholder sin præcise ordlyd.
 */
type VerificationFailureCopy = {
  integrityBody: string;
  unusableBody: string;
  closing: string;
};

const throwIfVerificationFailed = (
  verification: VerificationResult,
  copy: VerificationFailureCopy
): void => {
  if (verification.success) return;

  const kind: VerificationFailureKind = verification.kind ?? 'unusable';
  const heading = kind === 'integrity' ? 'INTEGRITETSKONTROL FEJLEDE' : 'FILEN ER IKKE BRUGBAR';
  const body = kind === 'integrity' ? copy.integrityBody : copy.unusableBody;

  let errorMsg = `${heading}: ${verification.error}\n\n` +
                 `${body}\n` +
                 `Detaljer: ${verification.details || 'Ukendt fejl'}\n\n`;

  if (verification.differences && verification.differences.length > 0) {
    errorMsg += `Forskelle fundet:\n`;
    const displayCount = Math.min(5, verification.differences.length);
    for (let i = 0; i < displayCount; i++) {
      errorMsg += `  ${i + 1}. ${verification.differences[i]}\n`;
    }
    if (verification.differences.length > 5) {
      errorMsg += `  ... og ${verification.differences.length - 5} flere\n`;
    }
    errorMsg += `\n`;
  }

  errorMsg += copy.closing;

  throw kind === 'integrity' ? new SaveIntegrityError(errorMsg) : new SaveUnusableFileError(errorMsg);
};

/**
 * Gemmer alle applikationsdata til krypteret .eo fil.
 *
 * Proces:
 * 1. Indsaml + schema-valider data (kun brugerinput persisteres)
 * 2. Opbyg container-metadata og kod ét artefakt (`EoFileCodec`)
 * 3. Resolver et typet gem-mål (`resolveSaveTarget`: handle / download / annulleret)
 * 4. Skriv til målet og verificér ét artefakt (read-back for File System Access, in-memory før download)
 * 5. Persistér filnavn/handle til sessionStorage/IndexedDB (til hurtig overskrivning næste gang)
 *
 * @param resolvedDirectory - Optional resolved directory fra resolveDefaultDirectoryHandle
 * @returns {Promise<SaveFileResult>} `saved` (med filnavn/statistik) eller `cancelled`
 * @throws {Error} Hvis gemning fejler (validering, integritet eller ubrugelig fil)
 */
export const saveToFile = async (
  snapshot: SaveSnapshot,
  resolvedDirectory?: ResolvedDirectory
): Promise<SaveFileResult> => {

  try {
    const orderedSnapshot = applyRegisteredTableSaveOrder(snapshot);
    const allDataRaw = buildAllDataRawFromSnapshot(orderedSnapshot);

    // VIGTIGT: `.eo` fil må kun indeholde schema-valideret brugerinput.
    const parsedData = eoFileDataSchema.safeParse(allDataRaw);
    if (!parsedData.success) {
      throw new Error(`Kan ikke gemme: Data matcher ikke schemas.\n${parsedData.error.message}`);
    }
    // VIGTIGT: `.eo` filer må kun indeholde schema-valideret brugerinput.
    // Brug den parsed repræsentation for at undgå at gemme ukendte felter, `null`-rester, mv.
    const canonicalData: CanonicalEoData = parsedData.data;

    // 2. Valider at vi har egentlige data at gemme
    if (!hasRealData(canonicalData)) {
      throw new SaveValidationError('Ingen data fundet at gemme');
    }

    // 3. Tæl antal felter med data til preflight-rapportering ved hent
    const fieldCount = countFilledFields(canonicalData);

    if (fieldCount === 0) {
      throw new SaveValidationError('Ingen udfyldte felter fundet');
    }

    // 4. Opbyg fil-struktur med metadata (codec stempler version + metadata; fieldCount
    //    genbruges til preflight-rapportering ved hent).
    const fileData: EoFileContainer = buildEoFileContainer(canonicalData, fieldCount);

    // 5. Krypter data
    const encrypted = await encodeEoFile(fileData);

    // 6. Resolver det typede gem-mål (genbrug handle / picker / fallback-download / annulleret).
    const target = await resolveSaveTarget(fileData, resolvedDirectory);
    if (target.kind === 'cancelled') {
      return { status: 'cancelled' };
    }

    // 7. Skriv til målet og verificér ét artefakt før/efter sinken alt efter dens read-back-evne.
    let filename: string;
    let verification: VerificationResult;
    let fallbackWarning: string | undefined;

    if (target.kind === 'fileHandle') {
      fallbackWarning = target.fallbackWarning;

      // Skriv til fil
      await writeToFileHandle(target.fileHandle, encrypted);
      filename = target.fileHandle.name;

      // VERIFICER at filen er gemt korrekt. File System Access-sinken understøtter read-back:
      // vi læser den netop skrevne fil tilbage og verificerer de faktiske bytes på disk.
      verification = await verifyAfterSave(target.fileHandle, canonicalData, true);

      if (!verification.success) {
        // KRITISK fejl - filen kunne ikke læses tilbage!
        logError('⚠⚠⚠ KRITISK: Fil blev gemt, men verificering fejlede!');
      }
      throwIfVerificationFailed(verification, {
        integrityBody: 'Filen blev skrevet og kan læses, men integritetskontrollen fejlede. Systemet kan derfor ikke garantere, at filen svarer præcist til den aktuelle beregning.',
        unusableBody: 'Filen blev skrevet, men kan ikke læses tilbage som en brugbar .eo-fil.',
        closing: 'Prøv at gemme igen.',
      });

      if (verification.warning) {
        // Advarsel - filen er læsbar, men noget er anderledes end forventet
        logWarning('⚠ Verificering fandt advarsler (se konsol for detaljer)');
        // Vi fortsætter - filen er teknisk OK, bare med advarsler
        // Advarslen returneres til UI senere
      }

      if (target.persistHandleAfterSuccess) {
        const persisted = await saveFileHandleToIndexedDB(target.fileHandle);
        if (!persisted) {
          logWarning('Gemt fil, men kunne ikke persistere file handle til senere overskrivning', {
            context: 'saveToFile.persistFileHandleAfterSuccess',
          });
        }
      }

      // Gem filnavn og stamdata til sessionStorage (til validering ved næste gem)
      persistSavedFilenameMetadata(filename, fileData.data.stamdata);

    } else {
      filename = target.filename;

      // VERIFICER indholdet FØR download. Fallback-sinken (browser-download) understøtter ikke
      // read-back, så det ene artefakt verificeres i hukommelsen, mens vi stadig kan afbryde:
      // et korrupt artefakt bliver aldrig downloadet (byg-og-verificér-før-sink).
      verification = await verifyAfterSave(encrypted, canonicalData, false);

      if (!verification.success) {
        // KRITISK fejl - data kunne ikke dekrypteres/verificeres før download!
        logError('⚠⚠⚠ KRITISK: Verificering af gemt data fejlede!');
      }
      throwIfVerificationFailed(verification, {
        integrityBody: 'Data blev opbygget og krypteret, men integritetskontrollen fejlede. Systemet kan derfor ikke garantere, at filen svarer præcist til den aktuelle beregning.',
        unusableBody: 'Data blev opbygget og krypteret, men den resulterende fil kan ikke verificeres som en brugbar .eo-fil.',
        closing: 'Dette er en alvorlig fejl - prøv at gemme igen.',
      });

      // Artefaktet er verificeret: download fil (browseren håndterer "filen eksisterer allerede").
      downloadFile(encrypted, filename, 'application/octet-stream');

      if (verification.warning) {
        // Advarsel - data er læsbar, men noget er anderledes end forventet
        logWarning('⚠ Verificering fandt advarsler (se konsol for detaljer)');
        // Vi fortsætter - filen er teknisk OK, bare med advarsler
      }

      persistSavedFilenameMetadata(filename, fileData.data.stamdata);
    }

    // Returner success-info (inkl. verifikation hvis der var advarsler)
    const result: SaveFileResult = {
      status: 'saved',
      filename,
      fieldCount,
      sections: Object.keys(canonicalData).length,
      verified: verification?.verified ?? false,
      ...((fallbackWarning || verification?.warning)
        ? {
            warning: [fallbackWarning, verification.message].filter(Boolean).join('\n\n'),
          }
        : {}),
    };

    return result;

  } catch (error: unknown) {

    const err = asError(error);

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = err.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    if (err instanceof SaveValidationError) {
      throw err;
    }

    logError('Gem-operation fejlede', {
      context: 'saveToFile',
      error: new Error(safeErrorMessage),
    });

    // Genkast med brugervenlig besked
    if (err instanceof SaveIntegrityError || err instanceof SaveUnusableFileError) {
      throw err;
    }

    throw new Error(`Kunne ikke gemme fil: ${err.message}`);
  }
};
