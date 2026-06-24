/**
 * Fælles opsætning for dokument-generatorer
 *
 * Alle generatorer indleder ens: opret writer, sæt display-mode og dokument-metadata.
 * Tidligere gentog hver generator denne preamble ordret (~18 steder), inkl. de samme
 * metadata-konstanter. Det samles her, så et metadata-felt kun har ét sandt sted.
 *
 * `creator` slås altid op via `getDocumentCreatorBrand()`. Tidligere hardkodede de
 * fleste generatorer literalen `'mineo.dk'`, mens kun rente-dokumenterne brugte
 * brandet — det var en latent drift: et brand-override (standalone MinProcesrente
 * via `setDocumentBrand`) ville have slået igennem på rente-PDF'erne, men efterladt
 * et forældet brand på alle øvrige. Nu er feltet ensartet.
 *
 * Brevhoved samles ikke her som ét trin: TAF/EO indskyder et udkast-stempel mellem
 * metadata og brevhoved og bygger brevhovedet fra `model.brevhoved` med egen brevdato,
 * mens de øvrige bygger fra stamdata med dags dato (`buildStamdataBrevhovedData`).
 */

import { createStandardPdfWriter, type DocumentWriter } from '../writer';
import { getDocumentCreatorBrand, type BrevhovedData } from '../layout/documentLayoutHelpers';
import type { DocumentStamdata } from '../layout/documentOptions';
import { TODAY } from '../../config/dateRanges';

/** Dokument-metadata der er ens for alle generatorer; kun titlen varierer. */
const DOCUMENT_SUBJECT = 'Erstatningsberegning';
const DOCUMENT_AUTHOR = 'Mineo';

/** Writer-options videreført til `createStandardPdfWriter` (udkast-stempel, fallback-log m.m.). */
export type StandardDocumentWriterOptions = Readonly<{
  visUdkastStempel?: boolean;
  orientation?: 'portrait' | 'landscape';
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>;

/**
 * Opretter en standard-writer med ensartet display-mode og dokument-metadata.
 *
 * Samler den preamble alle generatorer ellers gentog ordret
 * (`createStandardPdfWriter` → `setDisplayMode('fullheight')` → `setProperties`).
 */
export const initStandardDocumentWriter = (
  params: Readonly<{ title: string; options?: StandardDocumentWriterOptions }>
): DocumentWriter => {
  const writer = createStandardPdfWriter(params.options);
  writer.setDisplayMode('fullheight');
  writer.setProperties({
    title: params.title,
    subject: DOCUMENT_SUBJECT,
    author: DOCUMENT_AUTHOR,
    creator: getDocumentCreatorBrand(),
  });
  return writer;
};

/**
 * Bygger brevhoved-data fra stamdata med dags dato som brevdato.
 *
 * Den kanoniske konstruktion brugt af alle generatorer der modtager stamdata via
 * `DocumentCommonOptions`. (TAF/EO bygger i stedet fra `model.brevhoved` med en egen
 * brevdato og bruger derfor ikke denne helper.)
 */
export const buildStamdataBrevhovedData = (
  stamdata: DocumentStamdata | null | undefined
): BrevhovedData => ({
  journalnr: stamdata?.journalnr,
  advokat: stamdata?.advokat,
  sagsbehandler: stamdata?.sagsbehandler,
  dagsDatoISO: TODAY,
});

/** Et label/value-par der skrives som én venstre-højre-tekstlinje. */
export type DocumentLabelValueRow = Readonly<{
  label: string;
  value: string;
  rightFontStyle?: 'normal' | 'bold';
}>;

/**
 * Skriver en liste af label/value-par som venstre-højre-tekstlinjer.
 *
 * Konsoliderer den ordret ens række-løkke flere generatorer holdt lokalt
 * (`aarsloenDocument`, `varigeMenDocument`). Generatorer hvis rækker er string-par
 * (`satserDocument`) mapper til denne form ved callsite frem for at gentage løkken.
 */
export const writeLabelValueRows = (
  writer: DocumentWriter,
  rows: ReadonlyArray<DocumentLabelValueRow>
): void => {
  for (const row of rows) {
    writer.writeLeftRightText(row.label, row.value, {
      rightFontStyle: row.rightFontStyle ?? 'normal',
    });
  }
};
