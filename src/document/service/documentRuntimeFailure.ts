/**
 * Dokument-lagets mekaniske runtime-fejlhåndtering: dev-server-nedetidsdetektion, heuristik for
 * dynamic-import-fejl og routing af uventede fejl til den centrale systemfejl-overflade
 * (`document-output-contract.md` §A5).
 *
 * Udskilt fra `documentService.ts` i Fase 5, fordi den er MEKANIK og ikke domænepolitik: den
 * samme håndtering skal gælde alle 21 outputs, og efter Fase 5 er der kun én afvikler
 * (`runPreparedDocument`) der bruger den. Indholdet er flyttet uændret; ingen adfærdsændring.
 */
import { logWarning } from '../../utils/logger';
import { asError } from '../../utils/typeGuards';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { getDocumentFormatLabel } from '../documentFormat';
import { stamdataSchema, type StamdataValues } from '../../schemas/formSchemas';
import type { DocumentSettings } from '../layout/documentBrevhoved';

export type DocumentDownloadResult = Readonly<{ success: true } | { success: false; error: string }>;

export const DOCUMENT_DOWNLOAD_SUCCESS: DocumentDownloadResult = { success: true };

type PdfDownloadFailureKind = 'pdf_generation_failed' | 'dev_server_unavailable';

const DEV_SERVER_UNAVAILABLE_ERROR = 'Udviklingsserveren svarer ikke længere. Genstart `npm run dev` og prøv dokument-download igen.';
const DEV_SERVER_PING_TIMEOUT_MS = 1_000;
const DEV_SERVER_PING_PATH = '/@vite/client';
const DEV_SERVER_DOWN_CACHE_TTL_MS = 5_000;
const DEV_SERVER_PING_RETRY_DELAY_MS = 150;
const DEV_SERVER_PING_MAX_ATTEMPTS = 2;

// Kendt begrænsning: vi matcher på browser-specifikke fejlstrenge for dynamic-import-fejl
// (Chromium: "Failed to fetch dynamically imported module"; WebKit: "Importing a module script failed";
// Firefox: "error loading dynamically imported module"). Strengene er ikke del af nogen spec og
// kan ændre sig mellem browser-versioner. Vi accepterer skrøbeligheden fordi:
//   1) Detektionen er kun en heuristik til forbedret fejltekst; den er ikke korrekthedskritisk.
//   2) Primær dev-server-nedetidsdetektion sker via `isDevServerReachable`-ping, ikke via disse markers.
// Hvis en ny browser-version ændrer teksten, vil brugeren stadig se en generisk fejl — ikke datatab.
// Revurder listen, hvis PDF-downloads begynder at fejle stille uden dev-server-guidance.
const DYNAMIC_IMPORT_FETCH_ERROR_MARKERS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
] as const;

const isLikelyDynamicImportFetchError = (error: Error): boolean => {
  return DYNAMIC_IMPORT_FETCH_ERROR_MARKERS.some((marker) => error.message.includes(marker));
};

let lastKnownDevServerUnavailableAt: number | null = null;

const buildDevServerPingUrl = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return `${window.location.origin}${DEV_SERVER_PING_PATH}?t=${Date.now()}`;
};

const pingDevServerOnce = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return true;
  }

  const pingUrl = buildDevServerPingUrl();
  if (!pingUrl) {
    return true;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, DEV_SERVER_PING_TIMEOUT_MS);

  try {
    const response = await window.fetch(pingUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const waitForMs = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
};

const isDevServerReachable = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < DEV_SERVER_PING_MAX_ATTEMPTS; attempt += 1) {
    if (await pingDevServerOnce()) {
      return true;
    }
    if (attempt < DEV_SERVER_PING_MAX_ATTEMPTS - 1) {
      await waitForMs(DEV_SERVER_PING_RETRY_DELAY_MS);
    }
  }
  return false;
};

const createDevServerUnavailableFailure = (
  context: string,
  diagnostics?: Record<string, unknown>,
): DocumentDownloadResult => {
  const now = Date.now();
  const shouldReport =
    lastKnownDevServerUnavailableAt === null
    || (now - lastKnownDevServerUnavailableAt) >= DEV_SERVER_DOWN_CACHE_TTL_MS;
  lastKnownDevServerUnavailableAt = now;

  if (shouldReport) {
    reportSystemIssue({
      code: 'document:dev_server_unavailable',
      area: 'document',
      context,
      userMessage: DEV_SERVER_UNAVAILABLE_ERROR,
      developerMessage: 'Vite dev-server ping failed before PDF module load.',
      diagnostics: {
        mode: import.meta.env.MODE,
        origin: typeof window !== 'undefined' ? window.location.origin : null,
        pingPath: DEV_SERVER_PING_PATH,
        pingTimeoutMs: DEV_SERVER_PING_TIMEOUT_MS,
        pingAttempts: DEV_SERVER_PING_MAX_ATTEMPTS,
        ...diagnostics,
      },
    });
  }

  return { success: false, error: DEV_SERVER_UNAVAILABLE_ERROR };
};

const hasRecentDevServerUnavailableSignal = (): boolean => {
  if (lastKnownDevServerUnavailableAt === null) {
    return false;
  }

  return Date.now() - lastKnownDevServerUnavailableAt < DEV_SERVER_DOWN_CACHE_TTL_MS;
};

export const resetPdfServiceDevServerStateForTests = (): void => {
  lastKnownDevServerUnavailableAt = null;
};

export const ensureDevServerAvailableForPdfDownload = async (context: string): Promise<DocumentDownloadResult | null> => {
  if (!import.meta.env.DEV) {
    return null;
  }

  if (!hasRecentDevServerUnavailableSignal()) {
    return null;
  }

  if (await isDevServerReachable()) {
    resetPdfServiceDevServerStateForTests();
    return null;
  }

  return createDevServerUnavailableFailure(context, {
    check: 'cached_preflight_recheck',
  });
};

const resolvePdfDownloadFailureKind = async (error: Error): Promise<PdfDownloadFailureKind> => {
  if (!import.meta.env.DEV) {
    return 'pdf_generation_failed';
  }

  if (!isLikelyDynamicImportFetchError(error)) {
    return 'pdf_generation_failed';
  }

  return (await isDevServerReachable()) ? 'pdf_generation_failed' : 'dev_server_unavailable';
};

export const createPdfDownloadFailure = async (
  userError: string,
  context: string,
  error: unknown
): Promise<DocumentDownloadResult> => {
  const normalizedError = asError(error);
  const failureKind = await resolvePdfDownloadFailureKind(normalizedError);
  if (failureKind === 'dev_server_unavailable') {
    return createDevServerUnavailableFailure(context, {
      check: 'post_failure',
      originalErrorMessage: normalizedError.message,
    });
  }

  reportSystemIssue({
    code: 'document:download_failure',
    area: 'document',
    context,
    userMessage: userError,
    developerMessage: normalizedError.message,
    error: normalizedError,
  });
  return { success: false, error: userError };
};

// Tilpasser en PDF-formuleret fejltekst til det aktive download-format (jf.
// document-format-contract.md §5: brugervendt signal skal nævne det aktive format).
// Forudsætning: alle fejltekster der sendes hertil bruger "PDF" UDELUKKENDE som
// format-reference (fx "…-PDF"). Erstatningen er global og case-sensitiv; den må
// derfor ikke bruges på tekster hvor "PDF" optræder i en betydning der ikke skal
// følge formatet. formatLabel er altid 'PDF' (identitets-erstatning) eller 'Word'
// (intet "PDF"-substring), så erstatningen er idempotent og kan ikke selv-matche.
export const buildDocumentFailureMessage = (settings: DocumentSettings, pdfMessage: string): string => {
  const formatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  return pdfMessage.replace(/PDF/g, formatLabel);
};

/**
 * Parser kun dokumentets valgfrie stamdata-context; funktionen er ikke en downloadgate.
 * Domænedokumenter afgør selv, om datoorden er dokumentrelevant, før servicen kaldes.
 * Derfor bevares schema-gyldige canonical datoer her, også når deres indbyrdes orden
 * er et afledt issue; ellers ville fx et satsdokument miste hele brevhovedets stamdata.
 */
export const resolvePdfStamdata = (persistedStamdata: unknown): StamdataValues | null => {
  if (persistedStamdata == null) {
    return null;
  }

  const parsed = stamdataSchema.safeParse(persistedStamdata);
  if (!parsed.success) {
    logWarning('Stamdata kunne ikke valideres til PDF-generering', {
      context: 'pdfService.resolvePdfStamdata',
      data: { issueCount: parsed.error.issues.length },
    });
    return null;
  }

  return parsed.data;
};
