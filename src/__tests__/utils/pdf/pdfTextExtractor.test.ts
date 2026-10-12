import { extractPdfText } from './pdfTextExtractor';

describe('PDF-tekstudtræk', () => {
  it('springer billedbytes over, også med et indlejret DecodeParms-dictionary', async () => {
    const pdf = [
      '%PDF-1.3',
      '1 0 obj',
      '<< /Length 26 >>',
      'stream',
      'BT (2,28 % 110.044,38) Tj ET',
      'endstream',
      'endobj',
      '2 0 obj',
      '<< /Subtype /Image /DecodeParms << /Predictor 11 >> /Length 1 >>',
      'stream',
      '<',
      'endstream',
      'endobj',
      '%%EOF',
    ].join('\n');
    await expect(extractPdfText(new Blob([pdf], { type: 'application/pdf' }))).resolves.toBe('2,28 % 110.044,38');
  });
});
