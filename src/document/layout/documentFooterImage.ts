/**
 * Versions-footer som roteret billede (kanal-neutral)
 *
 * Footerens "<brand> // <version>" tegnes på et canvas, roteres 90° og eksporteres
 * som JPEG-dataURL med tilhørende mm-dimensioner. Billedet er format-agnostisk: det
 * lægges identisk ned i PDF (jsPDF `addImage`) og Word (docx floating `ImageRun`),
 * så versionsmærket står med nøjagtig samme skrift, farve, orientering og placering
 * i begge kanaler. Den eneste sandhedskilde for footerens udseende lever derfor her,
 * ikke i den enkelte kanal.
 *
 * Caches pr. footertekst, fordi tekst (brand + version) er konstant under en
 * dokument-generering, og canvas-rendering ellers gentages pr. side.
 */

import { VERSION } from '../../config/buildInfo';
import { getDocumentFooterBrand } from '../documentBrand';

const FOOTER_IMAGE_WIDTH_MM = 5.2;
const FOOTER_BASE_CANVAS_WIDTH_PX = 20;
const FOOTER_RENDER_SCALE = 6;
const FOOTER_FONT_SIZE_PX = 8;
const FOOTER_CANVAS_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const FOOTER_JPEG_QUALITY = 0.85;
const FOOTER_PADDING_PX = 12;
const FOOTER_MIN_HEIGHT_PX = 96;
const FOOTER_MAX_HEIGHT_PX = 220;

export type DocumentFooterImage = Readonly<{
  dataUrl: string;
  format: 'JPEG';
  widthMm: number;
  heightMm: number;
}>;

const footerImageCache = new Map<string, DocumentFooterImage | null>();

export const clearDocumentFooterImageCacheForTests = (): void => {
  if (import.meta.env.MODE !== 'test') return;
  footerImageCache.clear();
};

/** Footerens tekst: "<brand> // <version>". Eneste kilde til footer-strengen. */
export const buildDocumentFooterText = (): string => `${getDocumentFooterBrand()} // ${VERSION}`;

/**
 * Bygger (eller henter fra cache) versions-footeren som roteret JPEG-billede.
 * Returnerer null, hvis canvas ikke er tilgængeligt (fx server/test uden DOM) –
 * kalderen falder da tilbage til en tekst-footer.
 */
export const getDocumentFooterImage = (footerText: string): DocumentFooterImage | null => {
  const cached = footerImageCache.get(footerText);
  if (cached !== undefined) return cached;

  if (typeof document === 'undefined') {
    footerImageCache.set(footerText, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    footerImageCache.set(footerText, null);
    return null;
  }

  const canvasWidthPx = FOOTER_BASE_CANVAS_WIDTH_PX * FOOTER_RENDER_SCALE;
  const fontSizePx = FOOTER_FONT_SIZE_PX * FOOTER_RENDER_SCALE;
  ctx.font = `400 ${fontSizePx}px ${FOOTER_CANVAS_FONT_FAMILY}`;
  const measuredTextWidthPx = Math.ceil(ctx.measureText(footerText).width);
  canvas.width = canvasWidthPx;
  // Teksten roteres 90 grader i canvas. Derfor er målt tekstbredde (x-aksen før rotation)
  // bestemmende for canvas-højden i outputbilledet.
  const minHeightPx = FOOTER_MIN_HEIGHT_PX * FOOTER_RENDER_SCALE;
  const maxHeightPx = FOOTER_MAX_HEIGHT_PX * FOOTER_RENDER_SCALE;
  const paddedTextHeightPx = measuredTextWidthPx + FOOTER_PADDING_PX * FOOTER_RENDER_SCALE;
  canvas.height = Math.max(minHeightPx, Math.min(maxHeightPx, paddedTextHeightPx));

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-90 * Math.PI) / 180);
  // Canvas nulstiller drawing state (inkl. font) når width/height ændres.
  // Re-applier font her, så renderingen matcher målingen.
  ctx.font = `400 ${fontSizePx}px ${FOOTER_CANVAS_FONT_FAMILY}`;
  // Opaque farve undgår skjult alpha-afhængighed ved JPEG-encoding.
  ctx.fillStyle = 'rgb(192,192,192)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, 0, 0);
  ctx.restore();

  const image: DocumentFooterImage = {
    dataUrl: canvas.toDataURL('image/jpeg', FOOTER_JPEG_QUALITY),
    format: 'JPEG',
    widthMm: FOOTER_IMAGE_WIDTH_MM,
    heightMm: (canvas.height / canvas.width) * FOOTER_IMAGE_WIDTH_MM,
  };
  footerImageCache.set(footerText, image);
  return image;
};
