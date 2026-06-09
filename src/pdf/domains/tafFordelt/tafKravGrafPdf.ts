import { resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { MARGINS } from '../../infrastructure/pdfConfig';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import { type BrevhovedData } from '../../shared/pdfHelpers';
import { logWarning } from '../../../utils/logger';
import type { TafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { renderTafKravGrafChartPng, TAF_KRAV_GRAF_CANVAS } from './tafKravGrafChart';

const FILE_BASE_NAME = 'Visuel graf over indtægtsniveau';

// Glidende 3-måneders gennemsnit: dæmper måned-til-måned-støj uden at fjerne grafen
// for langt fra de faktiske indkomstniveauer. De præcise tal står i TAF-tabellerne.
const SMOOTHING_WINDOW_MONTHS = 3;

interface TafKravGrafPdfOptions {
  document: TafKravGrafDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafKravGrafPdf = (options: TafKravGrafPdfOptions): void => {
  const { document, visBrevhoved = false, visUdkastStempel = false } = options;
  const { model } = document;
  // Bevidst designvalg: UDKAST-vandmærket tegnes ALDRIG på denne graf, uanset
  // udkast-indstillingen. Et diagonalt vandmærke hen over de stablede arealer gør grafen
  // svær at aflæse og tilfører ingen værdi (grafen er et visuelt overblik, ikke et tal-bilag).
  // Derfor oprettes writeren med visUdkastStempel: false, og der kaldes ikke addUdkastWatermark().
  // Udkast-indstillingen afspejles fortsat i filnavnet, så en kladde stadig markeres som sådan.
  const writer = createStandardPdfWriter({
    visUdkastStempel: false,
    orientation: 'landscape',
    onLayoutFallback: ({ message, label }) => {
      logWarning('PDF-layout fallback aktiveret', {
        context: 'pdf.tafKravGraf.layout',
        data: { message, label },
      });
    },
  });

  writer.setDisplayMode('fullheight');
  writer.setProperties({
    title: 'Visuel graf over indtægtsniveau',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });

  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  const imageDataUrl = renderTafKravGrafChartPng(document, { smoothingWindow: SMOOTHING_WINDOW_MONTHS });
  const imageWidth = writer.getContentWidthMm();
  const imageHeight = Math.min(142, (imageWidth * TAF_KRAV_GRAF_CANVAS.height) / TAF_KRAV_GRAF_CANVAS.width);
  writer.ensureSpace(imageHeight + 8);
  const y = writer.getY() + 4;
  writer.addImageDataUrl(imageDataUrl, MARGINS.left, y, imageWidth, imageHeight);
  writer.setY(y + imageHeight + 4);

  writer.addFooter();
  writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
};
