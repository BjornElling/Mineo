// @vitest-environment jsdom
import { generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import { createDocumentGenerationSession } from '../../../document/documentGenerationSession';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import { toISODateString } from '../../../types/branded';

const pdfSession = createDocumentGenerationSession('pdf', createPdfChannelWriter);

describe('generateRenteDocument', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRenteDocument(pdfSession, 1000, toISODateString('2024-01-01'), toISODateString('2024-01-31'), []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });
});
