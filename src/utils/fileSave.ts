import { countFilledFields } from './dataCollection';
import { buildEoFileContainer, encodeEoFile } from './eoFileCodec';
import { downloadFile, type FilePickerDirectory } from './fileHelpers';
import {
  logError,
  logWarning,
} from './logger';
import {
  FileHandleAccessError,
  FileSaveRevisionChangedError,
  FileSaveSourceChangedError,
  readFromFileHandle,
  writeToFileHandle,
} from './fileSystemAccess';
import { deleteFileHandleFromIndexedDB, saveFileHandleToIndexedDB } from './fileHandleStorage';
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
  verifySaveArtifact,
} from './fileSaveInternals';
import { asError } from './typeGuards';
import { applyRegisteredTableSaveOrder } from './tableSaveOrderRegistry';
import { persistSavedFilenameMetadata } from './filePersistenceMetadata';
import { resolveSaveTarget, type ResolveSaveConflict } from './fileSaveTarget';
import { createFileContentFingerprint } from './fileContentFingerprint';
import { MAX_FILE_SIZE } from '../config/version';

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
 * 3. Verificér artefaktet og find et typet gem-mål (`resolveSaveTarget`: handle / download / annulleret)
 * 4. Skriv til målet og verificér ét artefakt (read-back for File System Access, in-memory før download)
 * 5. Persistér filnavn/handle til sessionStorage/IndexedDB (til hurtig overskrivning næste gang)
 *
 * @param resolvedDirectory - Optional resolved directory fra resolveDefaultDirectoryHandle
 * @param isSourceStillCurrent - Valgfri friskheds-kontrol, der kaldes UMIDDELBART efter gem-målet er resolvet
 *   (fil-pickeren er en async-grænse, hvor brugeren kan ændre sagen) og FØR nogen skrivning. Returnerer den
 *   `false`, afbrydes gemningen fail-closed som `stale` uden at røre disken – critical-action-kontrakten §5.
 * @returns {Promise<SaveFileResult>} `saved` (med filnavn/statistik), `cancelled` eller `stale`
 * @throws {Error} Hvis gemning fejler (validering, integritet eller ubrugelig fil)
 */
export const saveToFile = async (
  snapshot: SaveSnapshot,
  resolvedDirectory?: FilePickerDirectory,
  isSourceStillCurrent?: () => boolean,
  resolveConflict?: ResolveSaveConflict
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

    // 2. Tæl antal felter med data til save-metadata. Load genberegner sit eget tal efter eventuel
    // historisk ignore, så en gammel fils rå metadata ikke kan styre preflight-orienteringen.
    //
    // Her er BEVIDST ingen "er sagen tom?"-gate. Spørgsmålet kan ikke besvares her: dette lag ser kun det
    // schema-parsede snapshot og kender ikke ny-sags-baselinen, så det kan ikke skelne "intet indtastet" fra
    // "standardværdierne er bevidst valgt". Et tjek, der tæller udfyldte felter, regner hver `false` og hvert
    // standardtal som brugerdata og ville gemme en helt tom standardsag som et tilsyneladende rigtigt
    // sagsartefakt. Gaten ejes af `hasAnyData()` i save-shellen, som måler mod netop den baseline.
    //
    // `fieldCount === 0` er derfor ikke en fejl her: en sag KAN gyldigt bestå af udelukkende
    // standardværdier, når brugeren har ændret noget andet. Tallet er kun preflight-rapportering.
    const fieldCount = countFilledFields(canonicalData);

    // 4. Opbyg fil-struktur med metadata (codec stempler version + metadata).
    const fileData: EoFileContainer = buildEoFileContainer(canonicalData, fieldCount);

    // 5. Krypter data
    const encrypted = await encodeEoFile(fileData);
    // Load har samme størrelsesgrænse. Afvis før filvalg/write, så et for stort
    // artefakt aldrig overskriver en brugbar fil med noget, Mineo ikke kan åbne igen.
    if (new Blob([encrypted]).size > MAX_FILE_SIZE) {
      throw new SaveValidationError('Filen er for stor til at kunne indlæses igen. Gemningen blev afbrudt; dine indtastninger er bevaret.');
    }

    if (isSourceStillCurrent !== undefined && !isSourceStillCurrent()) return { status: 'stale' };

    // Verificér før filvalg: Chromium kan tømme en eksisterende fil, når brugeren
    // accepterer den i Gem-dialogen, før Mineo overhovedet får filhåndtaget.
    const verification = await verifySaveArtifact(encrypted, canonicalData);
    throwIfVerificationFailed(verification, {
      integrityBody: 'De klargjorte fildata svarer ikke præcist til den aktuelle sag.',
      unusableBody: 'De klargjorte fildata kan ikke læses som en brugbar .eo-fil.',
      closing: 'Prøv at gemme igen.',
    });
    if (isSourceStillCurrent !== undefined && !isSourceStillCurrent()) return { status: 'stale' };

    // 6. Resolver det typede gem-mål (genbrug handle / picker / fallback-download / annulleret).
    const target = await resolveSaveTarget(fileData, resolvedDirectory, resolveConflict, isSourceStillCurrent);
    if (target.kind === 'cancelled') {
      return { status: 'cancelled' };
    }

    // Kontrollér revisionen igen efter filvalget. Mineo må ikke skrive en
    // forældet sag, selv hvis browseren allerede har oprettet eller tømt målet.
    if (isSourceStillCurrent !== undefined && !isSourceStillCurrent()) {
      return { status: 'stale' };
    }

    // 7. Skriv til målet og verificér ét artefakt før/efter sinken alt efter dens read-back-evne.
    let filename: string;
    let fallbackWarning: string | undefined;
    const metadataWarnings: string[] = [];

    if (target.kind === 'fileHandle') {
      fallbackWarning = target.fallbackWarning;

      // Skriv til fil
      await writeToFileHandle(target.fileHandle, encrypted, target.expectedFingerprint, isSourceStillCurrent);
      filename = target.fileHandle.name;

      // Artefaktet er allerede valideret. Læs tilbage og kontrollér, at netop
      // dette krypterede indhold blev skrevet, før filen kobles til sagen.
      if (await readFromFileHandle(target.fileHandle) !== encrypted) {
        throw new SaveIntegrityError('Filen blev skrevet, men indholdet kunne ikke bekræftes. Prøv at gemme igen.');
      }

      if (target.persistHandleAfterSuccess) {
        const persisted = await saveFileHandleToIndexedDB(target.fileHandle);
        if (!persisted) {
          logWarning('Gemt fil, men kunne ikke persistere file handle til senere overskrivning', {
            context: 'saveToFile.persistFileHandleAfterSuccess',
          });
          metadataWarnings.push('Filen blev gemt, men koblingen til senere direkte Gem kunne ikke gemmes.');
        }
      }

      // Gem filnavn og stamdata til sessionStorage (til validering ved næste gem)
      try {
        persistSavedFilenameMetadata(filename, fileData.data.stamdata, await createFileContentFingerprint(encrypted));
      } catch {
        metadataWarnings.push('Filen blev gemt, men filnavnsoplysninger til næste Gem kunne ikke synkroniseres.');
      }

    } else {
      filename = target.filename;
      fallbackWarning = target.fallbackWarning;

      downloadFile(encrypted, filename, 'application/octet-stream');

      try {
        persistSavedFilenameMetadata(filename, fileData.data.stamdata);
      } catch {
        metadataWarnings.push('Filen blev gemt, men filnavnsoplysninger til næste Gem kunne ikke synkroniseres.');
      }
    }

    // Returner success-info (inkl. verifikation hvis der var advarsler)
    const result: SaveFileResult = {
      status: 'saved',
      filename,
      fieldCount,
      sections: Object.keys(canonicalData).length,
      verified: verification.verified ?? false,
      ...((fallbackWarning || metadataWarnings.length > 0)
        ? {
            warning: [fallbackWarning, ...metadataWarnings].filter(Boolean).join('\n\n'),
          }
        : {}),
    };

    return result;

  } catch (error: unknown) {

    const err = asError(error);
    if (err instanceof FileSaveSourceChangedError) return { status: 'stale' };
    // Bevar koblingen, så næste Gem kan vise konflikten på det kendte mål.
    if (err instanceof FileSaveRevisionChangedError) throw err;

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = err.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    if (err instanceof SaveValidationError || err instanceof FileHandleAccessError) {
      // Næste Gem skal give mulighed for en anden placering, også hvis browserens
      // permission stadig siger granted, mens operativsystemet afviser skrivningen.
      if (err instanceof FileHandleAccessError) await deleteFileHandleFromIndexedDB();
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

    throw new Error(`Kunne ikke gemme fil: ${err.message}`, { cause: error });
  }
};
