// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateKlLoenaftalerDocument } from '../../../document/generators/klLoenaftaler/klLoenaftalerDocument';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for KL-lønaftaler: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel og periode-reguleringssatser faktisk
// når .docx'en — og at der (modsat KRL) ikke skrives en kilde-linje.
describe('kl → Word-indhold', () => {
  it('skriver titel og periode-reguleringssatser til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateKlLoenaftalerDocument({ visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('KL-lønaftaler');
    // Kolonneoverskrifter for det 2-kolonners layout.
    expect(text).toContain('Dato');
    expect(text).toContain('Regulering');
    // Periode-reguleringssatser (ingen akkumuleret indeks vises).
    expect(text).toContain('4,00 %');
    expect(text).toContain('1,30 %');
    expect(text).not.toContain('1,124454');
    // KL-dokumentet har bevidst ingen kilde-linje (modsat KRL).
    expect(text).not.toContain('Kilde');
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const { documentXml } = await renderWordDocument(() => {
      generateKlLoenaftalerDocument({
        visBrevhoved: true,
        stamdata: { journalnr: '7788', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('7788');
  });
});
