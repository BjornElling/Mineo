// @vitest-environment jsdom
import { generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import { createDocumentGenerationSession } from '../../../document/documentGenerationSession';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';

const pdfSession = createDocumentGenerationSession('pdf', createPdfChannelWriter);

describe('generateRenteDocument', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRenteDocument(pdfSession, 1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });
});
