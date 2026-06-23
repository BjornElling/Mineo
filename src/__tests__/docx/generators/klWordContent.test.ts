/// <reference types="vitest/globals" />
import { generateKLDocument } from '../../../document/generators/kl/klDocument';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for KL-lønaftaler: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel, tabelindhold og akkumuleret indeks
// faktisk når .docx'en — og at der (modsat KRL) ikke skrives en kilde-linje.
describe('kl → Word-indhold', () => {
  it('skriver titel, linjetekst og akkumuleret indeks til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateKLDocument({ visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('KL-lønaftaler');
    // Kolonneoverskrifter for det 4-kolonners layout.
    expect(text).toContain('Regulering');
    expect(text).toContain('Procent');
    // Reguleringstype, procent og akkumuleret indeks (hver i sin kolonne).
    expect(text).toContain('Generelle stigninger');
    expect(text).toContain('1,30%');
    expect(text).toContain('1,124454');
    // KL-dokumentet har bevidst ingen kilde-linje (modsat KRL).
    expect(text).not.toContain('Kilde');
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const { documentXml } = await renderWordDocument(() => {
      generateKLDocument({
        visBrevhoved: true,
        stamdata: { journalnr: '7788', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('7788');
  });
});
