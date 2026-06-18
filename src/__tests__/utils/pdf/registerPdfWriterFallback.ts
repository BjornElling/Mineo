import { setFallbackDocumentWriterFactory } from '../../../document/documentGenerationContext';

/**
 * Registrerer PDF-kanalens writer-fabrik som fallback for den kanal-agnostiske router
 * (createStandardPdfWriter), så en unit-test kan kalde en generator DIREKTE uden at gå
 * gennem download-stien (runSelectedDocumentFormat), der ellers injicerer fabrikken.
 *
 * Importen af `createPdfChannelWriter` er bevidst DYNAMISK og sker først ved kald: den
 * skal ramme den jsPDF-mock, testen har sat op med `vi.mock('jspdf', ...)`. Et eager
 * top-level-import (eller import i den globale setup-fil) ville indlæse PDF-writeren og
 * den ægte jsPDF, før mock-hoisting trådte i kraft, så `writer.save()` ville skrive en
 * rigtig fil i stedet for at ramme test-spionen.
 *
 * Kald i et `beforeEach`. Word-stiende tests wrapper stadig eksplicit i
 * `withDocumentGenerationContext('word', ...)`, som vinder over fallbacken.
 */
export const registerPdfWriterFallbackForTest = async (): Promise<void> => {
  const { createPdfChannelWriter } = await import('../../../pdf/infrastructure/pdfWriter');
  setFallbackDocumentWriterFactory(createPdfChannelWriter);
};
