import type { AppSettings } from '../../settings/appSettingsSchema';
import {
  stamdataSchema,
  type StandardLoenTableRow,
  type ErstatningsopgoerelseValues,
  type LoenPaaHelligdage,
  type Loenperiode,
  type StamdataValues,
} from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import type { SelectedElements } from '../domains/eo/types';
import { getVisBrevhoved, type PdfType } from '../shared/pdfBrevhoved';
import {
  loadAarsloenPdfModule,
  loadErstatningsopgoerelsePdfModule,
  loadKRLPdfModule,
  loadLoebendeYdelserPdfModule,
  loadKapitaliseringPdfModule,
  loadEfterEalPdfModule,
  loadDifferencekravPdfModule,
  loadReguleringPdfModule,
  loadRentePdfModule,
  loadRenteOversigtPdfModule,
  loadSHDagePdfModule,
  loadSatserPdfModule,
  loadTafFordeltPaaAarPdfModule,
  loadTafOpreguleretPaaAarPdfModule,
  loadVarigeMenPdfModule,
  loadForsoergertabPdfModule,
} from './pdfLoader';
import { coerceToDanishDateString, type ISODateString } from '../../types/branded';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import type { EetLoebendeComputation } from '../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { EetKapitaliseringComputation } from '../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import type { EetEalComputation } from '../../domain/erhvervsevnetab/eetEalCalculation';
import type { EetDifferencekravComputation } from '../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import type { GenerateForsoergertabPdfParams } from '../domains/forsoergertab/forsoergertabPdf';
import type { BilagSelection } from '../domains/differencekrav/differencekravPdf';
import type { EoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import { eoSnapshotToTafPerYearPdfDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument';
import { eoSnapshotToTafPerYearOpreguleretPdfDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretPdfDocument';
import type { MidlertidigtEetAfgoerelseGroup } from '../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { logWarning } from '../../utils/logger';
import { asError } from '../../utils/typeGuards';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { getSatserForYear } from '../../data/lovbestemteRates';
import { resolveStamdataDatoLabel } from '../../domain/policies/stamdataCalculations';
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { RenteOversigtRow } from '../domains/renteberegning/renteOversigtPdf';
import { getDocumentFormatLabel } from '../../document/documentFormat';
import { withDocumentGenerationContext } from '../../document/documentGenerationContext';

type ReguleringInterval = Readonly<{
  fraDato: string;
  tilDato: string;
}>;

export type DocumentDownloadResult = Readonly<{ success: true } | { success: false; error: string }>;
export type PdfDownloadResult = DocumentDownloadResult;

type PdfStamdataForGenerators = StamdataValues;

type CommonPdfContext = Readonly<{
  visBrevhoved: boolean;
  stamdata: PdfStamdataForGenerators | null;
}>;

export type ReguleringPdfInput = Readonly<{
  overenskomstLabel: string;
  loenudviklingBasis: 'Overenskomst' | 'Statistik';
  overenskomstId: string | undefined;
  statistikModelLabel: string | undefined;
  interval: ReguleringInterval;
  applyAlmindeligLoenPaaShDageRegel: boolean;
  offentligLoenType?: string;
  offentligLoenTrin?: number;
  offentligLoenGruppe?: number;
  offentligLoenEkstraGrundloen?: number;
}>;

export type AarsloenPdfInput = Readonly<{
  satser: Readonly<{
    feriePct: number | undefined;
    fritvalgPct: number | undefined;
    shSoPct: number | undefined;
    storeBededagPct: number | undefined;
    pensionPct: number | undefined;
  }>;
  loenperiode: Loenperiode;
  tableData: readonly StandardLoenTableRow[];
  beregnetAarsloen: number;
  omregningTilFuldtAar: boolean;
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
  beregningsData: AarsloenBeregningResult;
}>;

type SHDagePeriod = Readonly<{
  start: Date;
  end: Date;
}>;
type SatserData = ReturnType<typeof getSatserForYear>;
type PdfDownloadFailureKind = 'pdf_generation_failed' | 'dev_server_unavailable';

const DOCUMENT_DOWNLOAD_SUCCESS: DocumentDownloadResult = { success: true };

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

const ensureDevServerAvailableForPdfDownload = async (context: string): Promise<PdfDownloadResult | null> => {
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

const createPdfDownloadFailure = async (
  userError: string,
  context: string,
  error: unknown
): Promise<PdfDownloadResult> => {
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
const buildDocumentFailureMessage = (settings: AppSettings, pdfMessage: string): string => {
  const formatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  return pdfMessage.replace(/PDF/g, formatLabel);
};

const runSelectedDocumentFormat = async (
  settings: AppSettings,
  generate: () => void
): Promise<DocumentDownloadResult> => {
  if (settings.documentDownloadFormat === 'word') {
    const { createDocxWriter } = await import('../../docx/infrastructure/docxWriter');
    await withDocumentGenerationContext('word', generate, { createWriter: createDocxWriter });
    return DOCUMENT_DOWNLOAD_SUCCESS;
  }

  await withDocumentGenerationContext('pdf', generate);
  return DOCUMENT_DOWNLOAD_SUCCESS;
};

const resolvePdfStamdata = (persistedStamdata: unknown): PdfStamdataForGenerators | null => {
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

const buildCommonPdfContext = (
  settings: AppSettings,
  pdfType: PdfType,
  persistedStamdata: unknown
): CommonPdfContext => {
  return {
    visBrevhoved: getVisBrevhoved(settings, pdfType),
    stamdata: resolvePdfStamdata(persistedStamdata),
  };
};

const resolveReguleringInterval = (interval: ReguleringInterval) => {
  const fraDato = coerceToDanishDateString(interval.fraDato);
  const tilDato = coerceToDanishDateString(interval.tilDato);

  if (!fraDato || !tilDato) {
    throw new Error(`Ugyldigt reguleringsinterval: ${interval.fraDato} - ${interval.tilDato}`);
  }

  return { fraDato, tilDato };
};

export const downloadSatserPdf = async (params: Readonly<{
  year: number;
  satser: SatserData;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { year, satser, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'satser', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadSatserPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateSatserPdf } = await loadSatserPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateSatserPdf(year, satser, common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere satser-PDF'), 'pdfService.downloadSatserPdf', error);
  }
};

export const downloadRentePdf = async (params: Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  latestReferenceRateDate: string | null;
  kommentarer?: string;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const {
    beloeb,
    actualInterestDate,
    beregningsdato,
    periods,
    latestReferenceRateDate,
    kommentarer,
    settings,
    persistedStamdata,
  } = params;
  const common = buildCommonPdfContext(settings, 'renteberegning', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadRentePdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateRentePdf } = await loadRentePdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateRentePdf(beloeb, actualInterestDate, beregningsdato, periods, {
        ...common,
        kommentarer,
        latestReferenceRateDate,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere rente-PDF'), 'pdfService.downloadRentePdf', error);
  }
};

export const downloadRenteOversigtPdf = async (params: Readonly<{
  beregningsdato: ISODateString;
  rows: ReadonlyArray<RenteOversigtRow>;
  kommentarer?: string;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { beregningsdato, rows, kommentarer, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'renteberegning', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadRenteOversigtPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateRenteOversigtPdf } = await loadRenteOversigtPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateRenteOversigtPdf(beregningsdato, rows, { ...common, kommentarer });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere rente-oversigt-PDF'), 'pdfService.downloadRenteOversigtPdf', error);
  }
};

export const downloadReguleringPdf = async (params: Readonly<{
  input: ReguleringPdfInput;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { input, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadReguleringPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateReguleringPdf } = await loadReguleringPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateReguleringPdf({
        ...input,
        interval: resolveReguleringInterval(input.interval),
        ...common,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere regulering-PDF'), 'pdfService.downloadReguleringPdf', error);
  }
};

export const downloadKrlPdf = async (params: Readonly<{
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { settings, persistedStamdata } = params;
  // Bevidst UX: KRL bruger samme brevhoved-indstilling som regulering (ingen separat KRL-toggle).
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadKrlPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateKRLPdf } = await loadKRLPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateKRLPdf(common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere KRL-PDF'), 'pdfService.downloadKrlPdf', error);
  }
};

export const downloadErstatningsopgoerelsePdf = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  settings: AppSettings;
  snapshot: EoSnapshot;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}>): Promise<PdfDownloadResult> => {
  const { selectedElements, settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const eoPdfDocument = eoSnapshotToEoPdfDocument(snapshot);
  if (eoPdfDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, eoPdfDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadErstatningsopgoerelsePdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateErstatningsopgoerelsePdf } = await loadErstatningsopgoerelsePdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateErstatningsopgoerelsePdf(params.stamdataValues, params.eoValues, selectedElements, {
        visBrevhoved,
        erstatningsopgoerelseAfsluttesMed: params.eoValues.erstatningsopgoerelseAfsluttesMed,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: eoPdfDocument.document,
        midlertidigtEetGroups: params.midlertidigtEetGroups,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere erstatningsopgørelse-PDF'),
      'pdfService.downloadErstatningsopgoerelsePdf',
      error
    );
  }
};

export const downloadTafFordeltPaaAarPdf = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  settings: AppSettings;
  snapshot: EoSnapshot;
}>): Promise<PdfDownloadResult> => {
  const { settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const tafPdfDocument = eoSnapshotToTafPerYearPdfDocument(snapshot);
  if (tafPdfDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, tafPdfDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadTafFordeltPaaAarPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateTafFordeltPaaAarPdf } = await loadTafFordeltPaaAarPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateTafFordeltPaaAarPdf({
        visBrevhoved,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: tafPdfDocument.document,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere TAF fordelt på år-PDF'),
      'pdfService.downloadTafFordeltPaaAarPdf',
      error
    );
  }
};

export const downloadTafOpreguleretPaaAarPdf = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  settings: AppSettings;
  snapshot: EoSnapshot;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}>): Promise<PdfDownloadResult> => {
  const { settings, snapshot, selectedElements } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const tafOpreguleretPdfDocument = eoSnapshotToTafPerYearOpreguleretPdfDocument(snapshot);
  if (tafOpreguleretPdfDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, tafOpreguleretPdfDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadTafOpreguleretPaaAarPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateTafOpreguleretPaaAarPdf } = await loadTafOpreguleretPaaAarPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateTafOpreguleretPaaAarPdf({
        visBrevhoved,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: tafOpreguleretPdfDocument.document,
        eoValues: params.eoValues,
        stamdataValues: params.stamdataValues,
        selectedElements,
        midlertidigtEetGroups: params.midlertidigtEetGroups,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere TAF opreguleret til beregningsår-PDF'),
      'pdfService.downloadTafOpreguleretPaaAarPdf',
      error
    );
  }
};

export const downloadVarigeMenPdf = async (params: Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const {
    fodselsdato,
    skadedato,
    mengrad,
    beregningsdato,
    beregningsResultat,
    settings,
    persistedStamdata,
  } = params;
  const common = buildCommonPdfContext(settings, 'varigeMen', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadVarigeMenPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateVarigeMenPdf } = await loadVarigeMenPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateVarigeMenPdf({
        fodselsdato,
        skadedato,
        mengrad,
        beregningsdato,
        beregningsResultat,
        skadedatoLabel: resolveStamdataDatoLabel(common.stamdata),
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere ménberegning-PDF'),
      'pdfService.downloadVarigeMenPdf',
      error
    );
  }
};

export const downloadAarsloenPdf = async (params: Readonly<{
  input: AarsloenPdfInput;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { input, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'aarsloensberegning', persistedStamdata);
  const stamdata = common.stamdata
    ? {
        journalnr: common.stamdata.journalnr,
        advokat: common.stamdata.advokat,
        sagsbehandler: common.stamdata.sagsbehandler,
      }
    : null;
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadAarsloenPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateAarsloenPdf } = await loadAarsloenPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateAarsloenPdf({
        ...input,
        stamdata,
        visBrevhoved: common.visBrevhoved,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere årsløn-PDF'), 'pdfService.downloadAarsloenPdf', error);
  }
};

export const downloadSHDagePdf = async (params: Readonly<{
  perioder: readonly SHDagePeriod[];
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { perioder, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'shDage', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadSHDagePdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateSHDagePdf } = await loadSHDagePdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateSHDagePdf(perioder, common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere SH-dage-PDF'), 'pdfService.downloadSHDagePdf', error);
  }
};

export const downloadKapitaliseringPdf = async (params: Readonly<{
  computation: EetKapitaliseringComputation;
  koen?: string;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { computation, koen, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadKapitaliseringPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateKapitaliseringPdf } = await loadKapitaliseringPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateKapitaliseringPdf({
        computation,
        koen,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere kapitalisering-PDF'),
      'pdfService.downloadKapitaliseringPdf',
      error
    );
  }
};

export const downloadEfterEalPdf = async (params: Readonly<{
  computation: EetEalComputation;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { computation, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadEfterEalPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateEfterEalPdf } = await loadEfterEalPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateEfterEalPdf({
        computation,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere EET efter EAL-PDF'),
      'pdfService.downloadEfterEalPdf',
      error
    );
  }
};

export const downloadDifferencekravPdf = async (params: Readonly<{
  computation: EetDifferencekravComputation;
  koen?: string;
  bilagSelection: BilagSelection;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { computation, koen, bilagSelection, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadDifferencekravPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateDifferencekravPdf } = await loadDifferencekravPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateDifferencekravPdf({
        computation,
        koen,
        bilagSelection,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere differencekrav-PDF'),
      'pdfService.downloadDifferencekravPdf',
      error
    );
  }
};

export const downloadLoebendeYdelserPdf = async (params: Readonly<{
  computation: EetLoebendeComputation;
  visUdvidetSpecifikation: boolean;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { computation, visUdvidetSpecifikation, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadLoebendeYdelserPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateLoebendeYdelserPdf } = await loadLoebendeYdelserPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateLoebendeYdelserPdf({
        computation,
        visUdvidetSpecifikation,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere løbende ydelser-PDF'),
      'pdfService.downloadLoebendeYdelserPdf',
      error
    );
  }
};

export const downloadForsoergertabPdf = async (params: Readonly<{
  pdfParams: Omit<GenerateForsoergertabPdfParams, 'visBrevhoved' | 'stamdata'>;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { pdfParams, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'forsoergertab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadForsoergertabPdf');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateForsoergertabPdf } = await loadForsoergertabPdfModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateForsoergertabPdf({
        ...pdfParams,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere forsørgertab-PDF'),
      'pdfService.downloadForsoergertabPdf',
      error
    );
  }
};
