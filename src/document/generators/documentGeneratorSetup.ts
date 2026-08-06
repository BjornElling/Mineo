/**
 * Fælles opsætning for dokument-generatorer
 *
 * Alle generatorer indleder ens: opret writer, sæt display-mode og dokument-metadata.
 * Tidligere gentog hver generator denne preamble ordret (~18 steder), inkl. de samme
 * metadata-konstanter. Det samles her, så et metadata-felt kun har ét sandt sted.
 * App-varianter kan give et eksplicit override, når dokumentets afsender/emne reelt
 * er anderledes end Mineo-standarderne.
 *
 * `creator` slås altid op via `getDocumentCreatorBrand()`. Tidligere hardkodede de
 * fleste generatorer literalen `'mineo.dk'`, mens kun rente-dokumenterne brugte
 * brandet — det var en latent drift: et brand-override (standalone MinProcesrente
 * via `setDocumentBrand`) ville have slået igennem på rente-PDF'erne, men efterladt
 * et forældet brand på alle øvrige. Nu er feltet ensartet.
 *
 * `defineDocument` ejer nu også den fælles lifecycle omkring indholdet. TAF/EO giver
 * deres særlige vandmærke- og brevhoveddata deklarativt, mens øvrige generatorer bruger
 * stamdata med dags dato (`buildStamdataBrevhovedData`).
 */

import { createDocumentComposer, type DocumentComposer } from '../model/documentModel';
import type { DocumentArtifact } from '../downloadArtifact';
import type { DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentDownloadFormat } from '../documentFormat';
import { getDocumentCreatorBrand, type BrevhovedData } from '../layout/documentLayoutHelpers';
import type { DocumentStamdata } from '../layout/documentOptions';
import { getToday } from '../../config/dateRanges';

/** Standard-metadata for Mineo-hovedappen; titlen varierer pr. dokument. */
const DOCUMENT_SUBJECT = 'Erstatningsberegning';
const DOCUMENT_AUTHOR = 'mineo.dk';

export type StandardDocumentMetadata = Readonly<{
  subject?: string;
  author?: string;
  creator?: string;
}>;

/** Writer-options videreført til sessionens writer-fabrik (udkast-stempel, fallback-log m.m.). */
export type StandardDocumentWriterOptions = Readonly<{
  orientation?: 'portrait' | 'landscape';
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>;

type DocumentValueResolver<TInput, TValue> = TValue | ((input: TInput) => TValue);

export type DocumentDefinition<TInput> = Readonly<{
  title: DocumentValueResolver<TInput, string>;
  filename: (input: TInput, format: DocumentDownloadFormat) => string;
  body: (writer: DocumentComposer, input: TInput) => undefined;
  writerOptions?: DocumentValueResolver<TInput, StandardDocumentWriterOptions | undefined>;
  metadata?: DocumentValueResolver<TInput, StandardDocumentMetadata | undefined>;
  brevhoved?: (input: TInput) => BrevhovedData | null;
  beforeBrevhoved?: (writer: DocumentComposer, input: TInput) => undefined;
  titleOptions?: DocumentValueResolver<
    TInput,
    Parameters<DocumentComposer['writeTitle']>[1]
  >;
  writeTitle?: boolean;
}>;

const resolveDocumentValue = <TInput, TValue>(
  resolver: DocumentValueResolver<TInput, TValue>,
  input: TInput
): TValue => (typeof resolver === 'function'
  ? (resolver as (value: TInput) => TValue)(input)
  : resolver);

export const resolveStandardDocumentProperties = (
  title: string,
  metadata?: StandardDocumentMetadata
): Readonly<{ title: string; subject: string; author: string; creator: string }> => ({
  title,
  subject: metadata?.subject ?? DOCUMENT_SUBJECT,
  author: metadata?.author ?? DOCUMENT_AUTHOR,
  creator: metadata?.creator ?? getDocumentCreatorBrand(),
});

/**
 * Definerer hele den fælles lifecycle for et dokument.
 *
 * Generatoren ejer fortsat dokumentets indhold, mens denne factory sikrer én fast
 * rækkefølge for writer-opsætning, eventuelt vandmærke/brevhoved, titel, footer og save.
 * `beforeBrevhoved` findes til de dokumenter, hvor udkast-vandmærket bevidst skal
 * tegnes før brevhovedet; grafdokumentet kan fravælge titel med `writeTitle: false`.
 */
export const defineDocument = <TInput>(
  definition: DocumentDefinition<TInput>
): ((session: DocumentGenerationSession, input: TInput) => Promise<DocumentArtifact>) => {
  return async (session, input) => {
    const title = resolveDocumentValue(definition.title, input);
    const { composer: writer, build } = createDocumentComposer();

    definition.beforeBrevhoved?.(writer, input);
    const brevhoved = definition.brevhoved?.(input) ?? null;
    if (brevhoved) {
      writer.writeBrevhoved(brevhoved);
    }
    if (definition.writeTitle !== false) {
      writer.writeTitle(
        title,
        definition.titleOptions
          ? resolveDocumentValue(definition.titleOptions, input)
          : undefined
      );
    }

    definition.body(writer, input);
    writer.addFooter();
    const metadata = definition.metadata ? resolveDocumentValue(definition.metadata, input) : undefined;
    const blob = await session.render({
      model: build(),
      writerOptions: definition.writerOptions ? resolveDocumentValue(definition.writerOptions, input) : undefined,
      properties: resolveStandardDocumentProperties(title, metadata),
    });
    // Filnavnet resolves med sessionens reelle format, så endelsen vælges direkte (ingen
    // "byg som .pdf og omskriv bagefter").
    const filename = definition.filename(input, session.format);
    return {
      blob,
      filename,
    };
  };
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
  dagsDatoISO: getToday(),
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
  writer: DocumentComposer,
  rows: ReadonlyArray<DocumentLabelValueRow>
): void => {
  for (const row of rows) {
    writer.writeLeftRightText(row.label, row.value, {
      rightFontStyle: row.rightFontStyle ?? 'normal',
    });
  }
};
