import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import { MARGINS } from '../../layout/pdfConfig';
import { defineDocument } from '../documentGeneratorSetup';
import { logWarning } from '../../../utils/logger';
import type { TafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { renderTafKravGrafChartPng, TAF_KRAV_GRAF_CANVAS } from './tafKravGrafChart';

const FILE_BASE_NAME = 'Visuel graf over indtægtsniveau';

interface TafKravGrafDocumentOptions {
  document: TafKravGrafDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

export const generateTafKravGrafDocument = defineDocument<TafKravGrafDocumentOptions>({
  title: 'Visuel graf over indtægtsniveau',
  filename: ({ document, visUdkastStempel = false }) => resolveDocumentArtifactFileName(
    FILE_BASE_NAME,
    visUdkastStempel,
    document.model.brevhoved?.journalnr
  ),
  writeTitle: false,
  // Bevidst designvalg: UDKAST-vandmærket tegnes ALDRIG på denne graf, uanset
  // udkast-indstillingen. Et diagonalt vandmærke hen over de stablede arealer gør grafen
  // svær at aflæse og tilfører ingen værdi (grafen er et visuelt overblik, ikke et tal-bilag).
  // Derfor oprettes writeren med visUdkastStempel: false, og der kaldes ikke addUdkastWatermark().
  // Udkast-indstillingen afspejles fortsat i filnavnet, så en kladde stadig markeres som sådan.
  writerOptions: {
      visUdkastStempel: false,
      orientation: 'landscape',
      onLayoutFallback: ({ message, label }) => {
        logWarning('PDF-layout fallback aktiveret', {
          context: 'pdf.tafKravGraf.layout',
          data: { message, label },
        });
      },
  },
  brevhoved: ({ document: { model }, visBrevhoved = false }) =>
    visBrevhoved && model.brevhoved
      ? {
        journalnr: model.brevhoved.journalnr,
        advokat: model.brevhoved.advokat,
        sagsbehandler: model.brevhoved.sagsbehandler,
        dagsDatoISO: model.brevhoved.dagsDatoISO,
      }
      : null,
  body: (writer, { document }) => {
  const imageDataUrl = renderTafKravGrafChartPng(document);
  const imageWidth = writer.getContentWidthMm();
  const imageHeight = Math.min(142, (imageWidth * TAF_KRAV_GRAF_CANVAS.height) / TAF_KRAV_GRAF_CANVAS.width);
  writer.ensureSpace(imageHeight + 8);
  const y = writer.getY() + 4;
  writer.addImageDataUrl(imageDataUrl, MARGINS.left, y, imageWidth, imageHeight);
  writer.setY(y + imageHeight + 4);

  },
});
