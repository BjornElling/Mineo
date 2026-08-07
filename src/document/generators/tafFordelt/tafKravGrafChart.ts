import type { TafKravGrafDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { renderSceneToCanvas } from './tafKravGrafCanvasRenderer';
import { buildTafKravGrafScene, TAF_KRAV_GRAF_CANVAS, type MeasureText } from './tafKravGrafScene';

// Entrypoint for "Visuel graf over indtægtsniveau": bygger scene-modellen og tegner den
// på et canvas, hvorefter resultatet returneres som en PNG-data-URL. Bruges af både PDF-
// og DOCX-generering (begge indlejrer resultatet som billede), så modulet er bevidst
// format-agnostisk.
//
// Opdelingen er bevidst: `tafKravGrafScene` ejer alle visuelle beslutninger og er fuldt
// testbar uden canvas; `tafKravGrafCanvasRenderer` oversætter dem mekanisk. Denne fil
// leverer kun det canvas, ingen af de to kan skaffe selv.

export { TAF_KRAV_GRAF_CANVAS };

export const renderTafKravGrafChartPng = (document: TafKravGrafDocument): string => {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('Grafen kræver browserens dokument-API.');
  }
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = TAF_KRAV_GRAF_CANVAS.width;
  canvas.height = TAF_KRAV_GRAF_CANVAS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Grafen kunne ikke oprette et canvas.');
  }

  // Tekstbredder måles med det rigtige canvas, så scenens centrerings- og
  // kollisionsbeslutninger bygger på den faktiske font-motor.
  const measureText: MeasureText = (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  renderSceneToCanvas(ctx, buildTafKravGrafScene(document, measureText));

  return canvas.toDataURL('image/png');
};
