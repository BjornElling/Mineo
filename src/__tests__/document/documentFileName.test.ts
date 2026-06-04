import { resolveDocumentFileName } from '../../document/documentFileName';
import { resolvePdfFileName } from '../../pdf/shared/pdfFormatUtils';

describe('resolveDocumentFileName', () => {
  it('bruger PDF- og Word-endelser med samme journalnr- og udkast-regel', () => {
    expect(resolveDocumentFileName('Testtitel', true, 'pdf', '1234')).toBe('1234 - Testtitel (udkast).pdf');
    expect(resolveDocumentFileName('Testtitel', true, 'word', '1234')).toBe('1234 - Testtitel (udkast).docx');
  });

  it('saniterer titel og journalnr før filnavnet bygges', () => {
    expect(resolveDocumentFileName('A<B>:C"D/E\\F|G?H*I', false, 'word', 'J:12/34')).toBe(
      'J_12_34 - A_B__C_D_E_F_G_H_I.docx'
    );
  });

  // Konvergens-værn: resolvePdfFileName må ikke have sin egen filnavnsregel — den er en tynd
  // wrapper om den fælles regel med format='pdf'. Holder kontrakt §4.4 (fælles regel, kun
  // endelsen adskiller) sand i koden og forhindrer at de to implementeringer driver fra hinanden.
  it('resolvePdfFileName er identisk med den fælles regel for pdf-format', () => {
    const cases: ReadonlyArray<{ title: string; draft: boolean; journalnr?: string }> = [
      { title: 'Testtitel', draft: true, journalnr: '1234' },
      { title: 'Testtitel', draft: false },
      { title: 'A<B>:C"D/E\\F|G?H*I', draft: false, journalnr: 'J:12/34' },
    ];
    for (const { title, draft, journalnr } of cases) {
      expect(resolvePdfFileName(title, draft, journalnr)).toBe(
        resolveDocumentFileName(title, draft, 'pdf', journalnr)
      );
    }
  });
});
