import JSZip from 'jszip';
import { createDocumentGenerationSession, type DocumentGenerationSession } from '../../../document/documentGenerationSession';
import { createDocxWriter } from '../../../docx/infrastructure/docxWriter';
import type { DocumentArtifact } from '../../../document/downloadArtifact';
import { findRawIsoDates } from '../../document/rawIsoDateDetection';

// Fælles harness for per-generator Word-indholdstests (jf.
// document-format-contract.md §4). Kører en RIGTIG generator gennem
// Word-backenden – generatoren modtager en eksplicit session med DocxWriter –
// fanger den returnerede .docx-blob og
// pakker word/document.xml ud, så testen kan assert'e semantisk indhold.
//
// Formålet er at fange "skjult indholdstab": fordi Word ikke er pixel-paritet,
// kan en manglende sektion/række ikke ses visuelt. Derfor assertes maskinelt.

export type RenderedWordDocument = Readonly<{
  filename: string;
  documentXml: string;
  zip: JSZip;
  blob: Blob;
}>;

// Renser OOXML til ren tekst (fjerner tags), så assertions kan matche labels/værdier
// uafhængigt af, hvordan teksten er splittet op i runs/afsnit.
export const xmlToPlainText = (xml: string): string =>
  xml
    .replace(/<w:tab\/>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Kører `run` gennem Word-backenden og returnerer den producerede .docx udpakket.
// `run` skal returnere generatorens færdige DocumentArtifact.
//
// Datoreglen (document-output-contract §A8) håndhæves her for ALLE generatorer: en rå
// ISO-dato i dokumentet er en programdato, der ikke er formateret ved kilden. Generatorerne
// er kanal-neutrale, så samme tekst når også PDF'en. Kun en ISO-formet tekst, testen selv
// har lagt i brugerens fritekst, må stå ordret (`verbatimUserIsoDates`).
export const renderWordDocument = async (
  run: (session: DocumentGenerationSession) => Promise<DocumentArtifact>,
  options?: Readonly<{ verbatimUserIsoDates?: readonly string[] }>
): Promise<RenderedWordDocument> => {
  const session = createDocumentGenerationSession('word', createDocxWriter);
  const artifact = await run(session);
  const zip = await JSZip.loadAsync(artifact.blob);
  const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';

  const allowed = new Set(options?.verbatimUserIsoDates ?? []);
  const leaks = findRawIsoDates(xmlToPlainText(documentXml)).filter((iso) => !allowed.has(iso));
  if (leaks.length > 0) {
    throw new Error(
      `Rå ISO-dato ${leaks.map((iso) => `"${iso}"`).join(', ')} nåede dokumentet. ` +
        'Formatér datoen ved kilden via formatDateShort/formatDateLong.'
    );
  }

  return { filename: artifact.filename, documentXml, zip, blob: artifact.blob };
};
