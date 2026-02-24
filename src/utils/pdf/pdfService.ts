import type { AppSettings } from '../../settings/appSettingsSchema';
import {
  erstatningsopgoerelseSchema,
  stamdataSchema,
  type AarsloenTableRow,
  type ErstatningsopgoerelseValues,
  type LoenPaaHelligdage,
  type Loenperiode,
  type StamdataValues,
} from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { PeriodeResult } from '../periodeBeregning';
import type { SelectedElements } from './erstatningsopgoerelse/types';
import { getVisBrevhoved, type PdfType } from './pdfBrevhoved';
import {
  loadAarsloenPdfModule,
  loadErstatningsopgoerelsePdfModule,
  loadKRLPdfModule,
  loadReguleringPdfModule,
  loadRentePdfModule,
  loadSHDagePdfModule,
  loadSatserPdfModule,
  loadTafFordeltPaaAarPdfModule,
  loadVarigeMenPdfModule,
} from './pdfLoader';
import { coerceToDanishDateString, type ISODateString } from '../../types/branded';
import type { VarigeMenBeregningResult } from '../../domain/varigemen/varigeMenCalculations';
import { logError, logWarning } from '../logger';
import { getSatserForYear } from '../../data/regulationRates';

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
  tableData: readonly AarsloenTableRow[];
  beregnetAarsloen: number;
  omregningTilFuldtAar: boolean;
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: boolean;
  retTilSjetteFerieuge: boolean;
  antalFeriedage: number | undefined;
  loenPaaHelligdage: LoenPaaHelligdage;
  shDageAntal: number | null;
  beregningsData: AarsloenBeregningResult;
  fejlmeddelelser: readonly string[];
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
  logError(userError, {
    context,
    error: toError(error),
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

const validateEoPdfPayload = (params: Readonly<{
  stamdataValues: unknown;
  eoValues: unknown;
}>): Readonly<{
  success: true;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
}> | Readonly<{ success: false }> => {
  const parsedStamdata = stamdataSchema.safeParse(params.stamdataValues);
  const parsedEo = erstatningsopgoerelseSchema.safeParse(params.eoValues);
  if (!parsedStamdata.success || !parsedEo.success) {
    logWarning('EO-data kunne ikke valideres til PDF-generering', {
      context: 'pdfService.validateEoPdfPayload',
      data: {
        stamdataIssueCount: parsedStamdata.success ? 0 : parsedStamdata.error.issues.length,
        eoIssueCount: parsedEo.success ? 0 : parsedEo.error.issues.length,
      },
    });
    return { success: false };
  }
  return {
    success: true,
    stamdataValues: parsedStamdata.data,
    eoValues: parsedEo.data,
  };
};

export const canDownloadEoPdf = (params: Readonly<{
  hasBlockingErrors: boolean;
  stamdataValues: unknown;
  eoValues: unknown;
}>): boolean => {
  if (params.hasBlockingErrors) return false;
  return validateEoPdfPayload({
    stamdataValues: params.stamdataValues,
    eoValues: params.eoValues,
  }).success;
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
}>): Promise<PdfDownloadResult> => {
  const { selectedElements, settings } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const validated = validateEoPdfPayload(params);

  if (!validated.success) {
    return { success: false, error: 'Kan ikke generere PDF: data er ugyldige.' };
  }

  try {
    const { generateErstatningsopgoerelsePdf } = await loadErstatningsopgoerelsePdfModule();
    generateErstatningsopgoerelsePdf(validated.stamdataValues, validated.eoValues, selectedElements, {
      visBrevhoved,
      erstatningsopgoerelseAfsluttesMed: validated.eoValues.erstatningsopgoerelseAfsluttesMed,
      visUdkastStempel: validated.eoValues.indsaetUdkastStempel === 'Ja',
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
}>): Promise<PdfDownloadResult> => {
  const { settings } = params;
  const visBrevhoved = getVisBrevhoved(settings, 'erstatningsopgoerelse');
  const validated = validateEoPdfPayload(params);

  if (!validated.success) {
    return { success: false, error: 'Kan ikke generere PDF: data er ugyldige.' };
  }

  try {
    const { generateTafFordeltPaaAarPdf } = await loadTafFordeltPaaAarPdfModule();
    generateTafFordeltPaaAarPdf(validated.stamdataValues, validated.eoValues, {
      visBrevhoved,
      visUdkastStempel: validated.eoValues.indsaetUdkastStempel === 'Ja',
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
  skadesdato: ISODateString | undefined;
  mengrad: number | undefined;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  settings: AppSettings;
  persistedStamdata: unknown;
}>): Promise<PdfDownloadResult> => {
  const {
    fodselsdato,
    skadesdato,
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
      skadesdato,
      mengrad,
      beregningsdato,
      beregningsResultat,
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

  try {
    const { generateAarsloenPdf } = await loadAarsloenPdfModule();
    generateAarsloenPdf({
      ...input,
      stamdata: common.stamdata,
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
    generateSHDagePdf(perioder, common.stamdata, { visBrevhoved: common.visBrevhoved });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return createPdfDownloadFailure('Kunne ikke generere SH-dage-PDF', 'pdfService.downloadSHDagePdf', error);
  }
};
