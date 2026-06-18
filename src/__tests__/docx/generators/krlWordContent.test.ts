/// <reference types="vitest/globals" />
import { generateKRLDocument } from '../../../document/generators/krl/krlDocument';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for KRL-satstabeller: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel, tabel og kilde faktisk når .docx'en.
describe('krl → Word-indhold', () => {
  it('skriver titel og kilde til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateKRLDocument({ visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('KRL Satstabeller');
    // Kildetekst under tabellen skal med, ellers er der tabt indhold.
    expect(text).toContain('Kilde');
    expect(text).toMatch(/krl\.dk/i);
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const { documentXml } = await renderWordDocument(() => {
      generateKRLDocument({
        visBrevhoved: true,
        stamdata: { journalnr: '5566', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('5566');
  });
});
