/**
 * Dokument-lagets mekaniske runtime-fejlhåndtering: dev-server-nedetidsdetektion, heuristik for
 * dynamic-import-fejl og routing af uventede fejl til den centrale systemfejl-overflade
 * (`document-output-contract.md` §A5).
 *
 * Udskilt fra `documentService.ts` i Fase 5, fordi den er MEKANIK og ikke domænepolitik: den samme
 * håndtering skal gælde alle 21 outputs.
 *
 * Modulet er hovedappens implementering af to porte på `DocumentExecutionEnvironment`
 * (`checkDevServerAvailability` og `reportFailure`) — ikke et lag, livscyklussen kalder direkte.
 * Standalone MinProcesrente leverer sine egne porte og importerer bevidst IKKE dette modul, fordi
 * `reportSystemIssue` er hovedapp-infrastruktur, som isolations-værnet holder ude af standalone.
 *
 * Brugerbeskeder hører IKKE her. De formuleres i `documentMessages.ts` ud fra udfaldets TILSTAND;
 * dette modul afgør kun, hvad der rapporteres til systemfejl-overfladen.
 */
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import type { DocumentDiagnostics, DocumentFailure } from '../definition/documentOutcome';

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

const noteDevServerUnavailable = (
  diagnostics: DocumentDiagnostics,
  extra: Record<string, unknown>,
): void => {
  const now = Date.now();
  const shouldReport =
    lastKnownDevServerUnavailableAt === null
    || (now - lastKnownDevServerUnavailableAt) >= DEV_SERVER_DOWN_CACHE_TTL_MS;
  lastKnownDevServerUnavailableAt = now;

  if (!shouldReport) return;

  reportSystemIssue({
    code: 'document:dev_server_unavailable',
    area: 'document',
    context: `document.${diagnostics.outputId}`,
    userMessage: DEV_SERVER_UNAVAILABLE_ERROR,
    developerMessage: 'Vite dev-server ping failed before document module load.',
    diagnostics: {
      mode: import.meta.env.MODE,
      origin: typeof window !== 'undefined' ? window.location.origin : null,
      outputId: diagnostics.outputId,
      phase: diagnostics.phase,
      pingPath: DEV_SERVER_PING_PATH,
      pingTimeoutMs: DEV_SERVER_PING_TIMEOUT_MS,
      pingAttempts: DEV_SERVER_PING_MAX_ATTEMPTS,
      ...extra,
    },
  });
};

const hasRecentDevServerUnavailableSignal = (): boolean => {
  if (lastKnownDevServerUnavailableAt === null) {
    return false;
  }

  return Date.now() - lastKnownDevServerUnavailableAt < DEV_SERVER_DOWN_CACHE_TTL_MS;
};

export const resetDocumentDevServerStateForTests = (): void => {
  lastKnownDevServerUnavailableAt = null;
};

/**
 * `checkDevServerAvailability`-porten for hovedappens miljø. Returnerer en `DocumentFailure`, hvis
 * afviklingen skal stoppe før modul-load, ellers `null`.
 */
export const ensureDevServerAvailableForDocumentDownload = async (
  diagnostics: DocumentDiagnostics
): Promise<DocumentFailure | null> => {
  if (!import.meta.env.DEV) return null;
  if (!hasRecentDevServerUnavailableSignal()) return null;

  if (await isDevServerReachable()) {
    resetDocumentDevServerStateForTests();
    return null;
  }

  noteDevServerUnavailable(diagnostics, { check: 'cached_preflight_recheck' });
  return { kind: 'dev-server-unavailable', phase: diagnostics.phase };
};

/**
 * `reportFailure`-porten for hovedappens miljø. Kun UVENTEDE runtimefejl rapporteres som systemfejl;
 * forventelige afvisninger (gate, stale, settle) og dev-server-nedetid når aldrig hertil (§A5).
 *
 * DEV-heuristikken for dynamic-import-fejl bevares, men den kan ikke længere ændre det udfald,
 * brugeren ser — den beriger kun diagnostikken. Tidligere kunne den omklassificere en runtimefejl til
 * "dev-server nede" EFTER at fejlteksten var valgt, hvilket gav to forskellige beskeder for samme
 * tilstand afhængigt af timing.
 */
export const reportDocumentRuntimeFailure = (
  failure: DocumentFailure,
  diagnostics: DocumentDiagnostics
): void => {
  if (failure.kind !== 'runtime') return;

  if (import.meta.env.DEV && isLikelyDynamicImportFetchError(failure.cause)) {
    noteDevServerUnavailable(diagnostics, {
      check: 'post_failure',
      originalErrorMessage: failure.cause.message,
    });
    return;
  }

  reportSystemIssue({
    code: 'document:download_failure',
    area: 'document',
    context: `document.${diagnostics.outputId}`,
    userMessage: 'Dokumentet kunne ikke genereres',
    developerMessage: failure.cause.message,
    error: failure.cause,
    diagnostics: { outputId: diagnostics.outputId, phase: diagnostics.phase },
  });
};
