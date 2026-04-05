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
  loadSHDagePdfModule,
  loadSatserPdfModule,
  loadTafFordeltPaaAarPdfModule,
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
import type { OffentligeYdelserRow } from '../../schemas/formSchemas';
import { logWarning } from '../../utils/logger';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { getSatserForYear } from '../../data/lovbestemteRates';
import { resolveStamdataDatoLabel } from '../../domain/policies/stamdataCalculations';

type ReguleringInterval = Readonly<{
  fraDato: string;
  tilDato: string;
}>;

export type PdfDownloadResult = Readonly<{ success: true } | { success: false; error: string }>;

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

const toError = (value: unknown): Error => {
  return value instanceof Error ? value : new Error(String(value));
};

const PDF_DOWNLOAD_SUCCESS: PdfDownloadResult = { success: true };

const createPdfDownloadFailure = (
  userError: string,
  context: string,
  error: unknown
): PdfDownloadResult => {
  const normalizedError = toError(error);
  reportSystemIssue({
    code: 'pdf:download_failure',
    area: 'pdf',
    context,
    userMessage: userError,
    developerMessage: normalizedError.message,
    error: normalizedError,
  });
  return { success: false, error: userError };
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

  try {
    const { generateSatserPdf } = await loadSatserPdfModule();
    generateSatserPdf(year, satser, common);
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere satser-PDF', 'pdfService.downloadSatserPdf', error);
  }
};

export const downloadRentePdf = async (params: Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  kommentarer?: string;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { beloeb, actualInterestDate, beregningsdato, kommentarer, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'renteberegning', persistedStamdata);

  try {
    const { generateRentePdf } = await loadRentePdfModule();
    generateRentePdf(beloeb, actualInterestDate, beregningsdato, { ...common, kommentarer });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere rente-PDF', 'pdfService.downloadRentePdf', error);
  }
};

export const downloadReguleringPdf = async (params: Readonly<{
  input: ReguleringPdfInput;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { input, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);

  try {
    const { generateReguleringPdf } = await loadReguleringPdfModule();
    generateReguleringPdf({
      ...input,
      interval: resolveReguleringInterval(input.interval),
      ...common,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere regulering-PDF', 'pdfService.downloadReguleringPdf', error);
  }
};

export const downloadKrlPdf = async (params: Readonly<{
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { settings, persistedStamdata } = params;
  // Intentional UX: KRL shares the same letterhead setting as regulering (no separate KRL toggle).
  const common = buildCommonPdfContext(settings, 'regulering', persistedStamdata);

  try {
    const { generateKRLPdf } = await loadKRLPdfModule();
    generateKRLPdf(common);
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere KRL-PDF', 'pdfService.downloadKrlPdf', error);
  }
};

export const downloadErstatningsopgoerelsePdf = async (params: Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  settings: AppSettings;
  snapshot: EoSnapshot;
  midlertidigtEetRows?: readonly OffentligeYdelserRow[];
}>): Promise<PdfDownloadResult> => {
  const { selectedElements, settings, snapshot } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const eoPdfDocument = eoSnapshotToEoPdfDocument(snapshot);
  if (eoPdfDocument.kind === 'blocked') {
    return { success: false, error: eoPdfDocument.message };
  }

  try {
    const { generateErstatningsopgoerelsePdf } = await loadErstatningsopgoerelsePdfModule();
    generateErstatningsopgoerelsePdf(params.stamdataValues, params.eoValues, selectedElements, {
      visBrevhoved,
      erstatningsopgoerelseAfsluttesMed: params.eoValues.erstatningsopgoerelseAfsluttesMed,
      visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
      document: eoPdfDocument.document,
      midlertidigtEetRows: params.midlertidigtEetRows,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere erstatningsopgørelse-PDF',
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
    return { success: false, error: tafPdfDocument.message };
  }

  try {
    const { generateTafFordeltPaaAarPdf } = await loadTafFordeltPaaAarPdfModule();
    generateTafFordeltPaaAarPdf({
      visBrevhoved,
      visUdkastStempel: params.eoValues.indsaetUdkastStempel === 'Ja',
      document: tafPdfDocument.document,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere TAF fordelt på år-PDF',
      'pdfService.downloadTafFordeltPaaAarPdf',
      error
    );
  }
};

export const downloadVarigeMenPdf = async (params: Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number | undefined;
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

  try {
    const { generateVarigeMenPdf } = await loadVarigeMenPdfModule();
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
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere ménberegning-PDF',
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

  try {
    const { generateAarsloenPdf } = await loadAarsloenPdfModule();
    generateAarsloenPdf({
      ...input,
      stamdata,
      visBrevhoved: common.visBrevhoved,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere årsløn-PDF', 'pdfService.downloadAarsloenPdf', error);
  }
};

export const downloadSHDagePdf = async (params: Readonly<{
  perioder: readonly SHDagePeriod[];
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const { perioder, settings, persistedStamdata } = params;
  const common = buildCommonPdfContext(settings, 'shDage', persistedStamdata);

  try {
    const { generateSHDagePdf } = await loadSHDagePdfModule();
    generateSHDagePdf(perioder, common);
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere SH-dage-PDF', 'pdfService.downloadSHDagePdf', error);
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

  try {
    const { generateKapitaliseringPdf } = await loadKapitaliseringPdfModule();
    generateKapitaliseringPdf({
      computation,
      koen,
      visBrevhoved: common.visBrevhoved,
      stamdata: common.stamdata,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere kapitalisering-PDF',
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

  try {
    const { generateEfterEalPdf } = await loadEfterEalPdfModule();
    generateEfterEalPdf({
      computation,
      visBrevhoved: common.visBrevhoved,
      stamdata: common.stamdata,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere EET efter EAL-PDF',
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

  try {
    const { generateDifferencekravPdf } = await loadDifferencekravPdfModule();
    generateDifferencekravPdf({
      computation,
      koen,
      bilagSelection,
      visBrevhoved: common.visBrevhoved,
      stamdata: common.stamdata,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere differencekrav-PDF',
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

  try {
    const { generateLoebendeYdelserPdf } = await loadLoebendeYdelserPdfModule();
    generateLoebendeYdelserPdf({
      computation,
      visUdvidetSpecifikation,
      visBrevhoved: common.visBrevhoved,
      stamdata: common.stamdata,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere løbende ydelser-PDF',
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

  try {
    const { generateForsoergertabPdf } = await loadForsoergertabPdfModule();
    generateForsoergertabPdf({
      ...pdfParams,
      visBrevhoved: common.visBrevhoved,
      stamdata: common.stamdata,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure(
      'Kunne ikke generere forsørgertab-PDF',
      'pdfService.downloadForsoergertabPdf',
      error
    );
  }
};
