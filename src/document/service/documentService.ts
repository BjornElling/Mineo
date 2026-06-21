import {
  stamdataSchema,
  type StandardLoenTableRow,
  type ErstatningsopgoerelseValues,
  type LoenPaaHelligdage,
  type Loenperiode,
  type TillaegAngivesSom,
  type StamdataValues,
} from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import type { SelectedElements } from '../generators/eo/types';
import { getVisBrevhoved, type DocumentBrevhovedType, type DocumentSettings } from '../layout/documentBrevhoved';
import {
  loadAarsloenDocumentModule,
  loadErstatningsopgoerelseDocumentModule,
  loadKRLDocumentModule,
  loadLoebendeYdelserDocumentModule,
  loadKapitaliseringDocumentModule,
  loadEfterEalDocumentModule,
  loadDifferencekravDocumentModule,
  loadReguleringDocumentModule,
  loadRenteDocumentModule,
  loadRenteOversigtDocumentModule,
  loadSHDageDocumentModule,
  loadSatserDocumentModule,
  loadTafFordeltPaaAarDocumentModule,
  loadTafKravGrafDocumentModule,
  loadTafOpreguleretPaaAarDocumentModule,
  loadVarigeMenDocumentModule,
  loadForsoergertabDocumentModule,
} from './documentLoader';
import { coerceToDanishDateString, type ISODateString } from '../../types/branded';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import type { EetLoebendeComputation } from '../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import type { EetKapitaliseringComputation } from '../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import type { EetEalComputation } from '../../domain/erhvervsevnetab/eetEalCalculation';
import type { EetDifferencekravComputation } from '../../domain/erhvervsevnetab/eetDifferencekravCalculation';
import type { GenerateForsoergertabDocumentParams } from '../generators/forsoergertab/forsoergertabDocument';
import type { BilagSelection } from '../generators/differencekrav/differencekravDocument';
import type { EoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { eoSnapshotToTafPerYearDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';
import { eoSnapshotToTafPerYearOpreguleretDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import { eoSnapshotToTafKravGrafDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import type { MidlertidigtEetAfgoerelseGroup } from '../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { logWarning } from '../../utils/logger';
import { asError } from '../../utils/typeGuards';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { getSatserForYear } from '../../data/lovbestemteRates';
import { resolveStamdataDatoLabel } from '../../domain/policies/stamdataCalculations';
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { RenteOversigtRow } from '../generators/renteberegning/renteOversigtDocument';
import { getDocumentFormatLabel } from '../documentFormat';
import { withDocumentGenerationContext } from '../documentGenerationContext';

type ReguleringInterval = Readonly<{
  fraDato: string;
  tilDato: string;
}>;

export type DocumentDownloadResult = Readonly<{ success: true } | { success: false; error: string }>;

type PdfStamdataForGenerators = StamdataValues;

type CommonPdfContext = Readonly<{
  visBrevhoved: boolean;
  stamdata: PdfStamdataForGenerators | null;
}>;

export type ReguleringDocumentInput = Readonly<{
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

export type AarsloenDocumentInput = Readonly<{
  satser: Readonly<{
    feriePct: number | undefined;
    fritvalgPct: number | undefined;
    shSoPct: number | undefined;
    storeBededagPct: number | undefined;
    pensionPct: number | undefined;
  }>;
  loenperiode: Loenperiode;
  tillaegAngivesSom: TillaegAngivesSom;
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

const ensureDevServerAvailableForPdfDownload = async (context: string): Promise<DocumentDownloadResult | null> => {
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
const buildDocumentFailureMessage = (settings: DocumentSettings, pdfMessage: string): string => {
  const formatLabel = getDocumentFormatLabel(settings.documentDownloadFormat);
  return pdfMessage.replace(/PDF/g, formatLabel);
};

// Ikke-indlysende invariant: Word-stien returnerer kun success, fordi
// withDocumentGenerationContext internt afventer `Promise.all(pendingDownloads)`, før den
// returnerer. Word-writeren samler sit endelige .docx asynkront via en pending download, så en
// fejl undervejs forplanter sig kun hertil (og bobler op i catch-stien) så længe den await
// bevares. Fjernes `await Promise.all(...)` i documentGenerationContext.ts ved en refaktor, vil
// Word-fejl returnere success i stilhed og producere et tomt/korrupt dokument uden fejlrapport.
const runSelectedDocumentFormat = async (
  settings: DocumentSettings,
  generate: () => void
): Promise<DocumentDownloadResult> => {
  if (settings.documentDownloadFormat === 'word') {
    const { createDocxWriter } = await import('../../docx/infrastructure/docxWriter');
    await withDocumentGenerationContext('word', generate, { createWriter: createDocxWriter });
    return DOCUMENT_DOWNLOAD_SUCCESS;
  }

  // PDF-fabrikken injiceres på samme vis som Word-fabrikken, så den kanal-agnostiske
  // router (createStandardPdfWriter) aldrig selv importerer en kanal statisk.
  const { createPdfChannelWriter } = await import('../../pdf/infrastructure/pdfWriter');
  await withDocumentGenerationContext('pdf', generate, { createWriter: createPdfChannelWriter });
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
  settings: DocumentSettings,
  pdfType: DocumentBrevhovedType,
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

export const downloadSatserDokument = async (params: Readonly<{
  year: number;
  satser: SatserData;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { year, satser, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'satser', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadSatserDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateSatserDocument } = await loadSatserDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateSatserDocument(year, satser, common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere satser-PDF'), 'pdfService.downloadSatserDokument', error);
  }
};

export const downloadRenteDokument = async (params: Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  latestReferenceRateDate: string | null;
  kommentarer?: string;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
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
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadRenteDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateRenteDocument } = await loadRenteDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateRenteDocument(beloeb, actualInterestDate, beregningsdato, periods, {
        ...common,
        kommentarer,
        latestReferenceRateDate,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere rente-PDF'), 'pdfService.downloadRenteDokument', error);
  }
};

export const downloadRenteOversigtDokument = async (params: Readonly<{
  beregningsdato: ISODateString;
  rows: ReadonlyArray<RenteOversigtRow>;
  kommentarer?: string;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { beregningsdato, rows, kommentarer, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'renteberegning', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadRenteOversigtDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateRenteOversigtDocument } = await loadRenteOversigtDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateRenteOversigtDocument(beregningsdato, rows, { ...common, kommentarer });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere rente-oversigt-PDF'), 'pdfService.downloadRenteOversigtDokument', error);
  }
};

export const downloadReguleringDokument = async (params: Readonly<{
  input: ReguleringDocumentInput;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { input, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadReguleringDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateReguleringDocument } = await loadReguleringDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateReguleringDocument({
        ...input,
        interval: resolveReguleringInterval(input.interval),
        ...common,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere regulering-PDF'), 'pdfService.downloadReguleringDokument', error);
  }
};

export const downloadKrlDokument = async (params: Readonly<{
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { settings, persistedStamdata } = params;
  // Bevidst UX: KRL bruger samme brevhoved-indstilling som regulering (ingen separat KRL-toggle).
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadKrlDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateKRLDocument } = await loadKRLDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateKRLDocument(common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere KRL-PDF'), 'pdfService.downloadKrlDokument', error);
  }
};

export const downloadErstatningsopgoerelseDokument = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  settings: DocumentSettings;
  snapshot: EoSnapshot;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}>): Promise<DocumentDownloadResult> => {
  const { selectedElements, settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const eoDocument = eoSnapshotToEoDocument(snapshot);
  if (eoDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, eoDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadErstatningsopgoerelseDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateErstatningsopgoerelseDocument } = await loadErstatningsopgoerelseDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateErstatningsopgoerelseDocument(params.stamdataValues, params.eoValues, selectedElements, {
        visBrevhoved,
        erstatningsopgoerelseAfsluttesMed: params.eoValues.erstatningsopgoerelseAfsluttesMed,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: eoDocument.document,
        midlertidigtEetGroups: params.midlertidigtEetGroups,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere erstatningsopgørelse-PDF'),
      'pdfService.downloadErstatningsopgoerelseDokument',
      error
    );
  }
};

export const downloadTafFordeltPaaAarDokument = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  settings: DocumentSettings;
  snapshot: EoSnapshot;
}>): Promise<DocumentDownloadResult> => {
  const { settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const tafDocument = eoSnapshotToTafPerYearDocument(snapshot);
  if (tafDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, tafDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadTafFordeltPaaAarDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateTafFordeltPaaAarDocument } = await loadTafFordeltPaaAarDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateTafFordeltPaaAarDocument({
        visBrevhoved,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: tafDocument.document,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere TAF fordelt på år-PDF'),
      'pdfService.downloadTafFordeltPaaAarDokument',
      error
    );
  }
};

export const downloadTafOpreguleretPaaAarDokument = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  settings: DocumentSettings;
  snapshot: EoSnapshot;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
}>): Promise<DocumentDownloadResult> => {
  const { settings, snapshot, selectedElements } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const tafOpreguleretDocument = eoSnapshotToTafPerYearOpreguleretDocument(snapshot);
  if (tafOpreguleretDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, tafOpreguleretDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadTafOpreguleretPaaAarDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateTafOpreguleretPaaAarDocument } = await loadTafOpreguleretPaaAarDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateTafOpreguleretPaaAarDocument({
        visBrevhoved,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: tafOpreguleretDocument.document,
        eoValues: params.eoValues,
        stamdataValues: params.stamdataValues,
        selectedElements,
        midlertidigtEetGroups: params.midlertidigtEetGroups,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere TAF opreguleret til beregningsår-PDF'),
      'pdfService.downloadTafOpreguleretPaaAarDokument',
      error
    );
  }
};

export const downloadTafKravGrafDokument = async (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  settings: DocumentSettings;
  snapshot: EoSnapshot;
}>): Promise<DocumentDownloadResult> => {
  const { settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const tafKravGrafDocument = eoSnapshotToTafKravGrafDocument(snapshot);
  if (tafKravGrafDocument.kind === 'blocked') {
    return { success: false, error: buildDocumentFailureMessage(settings, tafKravGrafDocument.message) };
  }
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadTafKravGrafDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateTafKravGrafDocument } = await loadTafKravGrafDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateTafKravGrafDocument({
        visBrevhoved,
        visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
        document: tafKravGrafDocument.document,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere Visuel graf over indtægtsniveau-PDF'),
      'pdfService.downloadTafKravGrafDokument',
      error
    );
  }
};

export const downloadVarigeMenDokument = async (params: Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
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
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadVarigeMenDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateVarigeMenDocument } = await loadVarigeMenDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateVarigeMenDocument({
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
      'pdfService.downloadVarigeMenDokument',
      error
    );
  }
};

export const downloadAarsloenDokument = async (params: Readonly<{
  input: AarsloenDocumentInput;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { input, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'aarsloensberegning', persistedStamdata);
  const stamdata = common.stamdata
    ? {
        journalnr: common.stamdata.journalnr,
        advokat: common.stamdata.advokat,
        sagsbehandler: common.stamdata.sagsbehandler,
      }
    : null;
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadAarsloenDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateAarsloenDocument } = await loadAarsloenDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateAarsloenDocument({
        ...input,
        stamdata,
        visBrevhoved: common.visBrevhoved,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere årsløn-PDF'), 'pdfService.downloadAarsloenDokument', error);
  }
};

export const downloadSHDageDokument = async (params: Readonly<{
  perioder: readonly SHDagePeriod[];
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { perioder, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'shDage', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadSHDageDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateSHDageDocument } = await loadSHDageDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateSHDageDocument(perioder, common);
    });
  } catch (error) {
    return await createPdfDownloadFailure(buildDocumentFailureMessage(settings, 'Kunne ikke generere SH-dage-PDF'), 'pdfService.downloadSHDageDokument', error);
  }
};

export const downloadKapitaliseringDokument = async (params: Readonly<{
  computation: EetKapitaliseringComputation;
  koen?: string;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { computation, koen, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadKapitaliseringDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateKapitaliseringDocument } = await loadKapitaliseringDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateKapitaliseringDocument({
        computation,
        koen,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere kapitalisering-PDF'),
      'pdfService.downloadKapitaliseringDokument',
      error
    );
  }
};

export const downloadEfterEalDokument = async (params: Readonly<{
  computation: EetEalComputation;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { computation, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadEfterEalDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateEfterEalDocument } = await loadEfterEalDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateEfterEalDocument({
        computation,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere EET efter EAL-PDF'),
      'pdfService.downloadEfterEalDokument',
      error
    );
  }
};

export const downloadDifferencekravDokument = async (params: Readonly<{
  computation: EetDifferencekravComputation;
  koen?: string;
  bilagSelection: BilagSelection;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { computation, koen, bilagSelection, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadDifferencekravDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateDifferencekravDocument } = await loadDifferencekravDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateDifferencekravDocument({
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
      'pdfService.downloadDifferencekravDokument',
      error
    );
  }
};

export const downloadLoebendeYdelserDokument = async (params: Readonly<{
  computation: EetLoebendeComputation;
  visUdvidetSpecifikation: boolean;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { computation, visUdvidetSpecifikation, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'erhvervsevnetab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadLoebendeYdelserDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateLoebendeYdelserDocument } = await loadLoebendeYdelserDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateLoebendeYdelserDocument({
        computation,
        visUdvidetSpecifikation,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere løbende ydelser-PDF'),
      'pdfService.downloadLoebendeYdelserDokument',
      error
    );
  }
};

export const downloadForsoergertabDokument = async (params: Readonly<{
  pdfParams: Omit<GenerateForsoergertabDocumentParams, 'visBrevhoved' | 'stamdata'>;
  settings: DocumentSettings;
  persistedStamdata: unknown;
}>): Promise<DocumentDownloadResult> => {
  const { pdfParams, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'forsoergertab', persistedStamdata);
  const preflightFailure = await ensureDevServerAvailableForPdfDownload('pdfService.downloadForsoergertabDokument');
  if (preflightFailure) return preflightFailure;

  try {
    const { generateForsoergertabDocument } = await loadForsoergertabDocumentModule();
    return await runSelectedDocumentFormat(settings, () => {
      generateForsoergertabDocument({
        ...pdfParams,
        visBrevhoved: common.visBrevhoved,
        stamdata: common.stamdata,
      });
    });
  } catch (error) {
    return await createPdfDownloadFailure(
      buildDocumentFailureMessage(settings, 'Kunne ikke generere forsørgertab-PDF'),
      'pdfService.downloadForsoergertabDokument',
      error
    );
  }
};
