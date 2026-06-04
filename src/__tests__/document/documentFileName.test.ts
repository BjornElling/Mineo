import { resolveDocumentFileName } from '../../document/documentFileName';

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
});
