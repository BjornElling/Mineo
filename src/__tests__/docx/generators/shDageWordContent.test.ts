/// <reference types="vitest/globals" />
import { generateSHDagePdf } from '../../../pdf/domains/aarsloen/shDagePdf';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for SH-dage-dokumentet: kører den RIGTIGE generator gennem
// Word-backenden og verificerer, at titel, periode-beskrivelse, helligdagstabel
// og forklaringstekst faktisk når .docx'en.
describe('shDage → Word-indhold', () => {
  it('skriver titel, tabel-overskrifter og forklaring til .docx', async () => {
    const perioder = [
      { start: new Date(Date.UTC(2024, 0, 1)), end: new Date(Date.UTC(2024, 11, 31)) },
    ];

    const { filename, documentXml } = await renderWordDocument(() => {
      generateSHDagePdf(perioder, { visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('SH-dage');
    // Periode-beskrivelse
    expect(text).toContain('Periode:');
    // Tabel-headers
    expect(text).toContain('Ugedag');
    expect(text).toContain('Helligdag');
    // Et reelt helligdagsnavn der falder i perioden
    expect(text).toContain('Nytårsdag');
    // Total-række + forklaringsafsnit
    expect(text).toContain('SH-dage i alt');
    expect(text).toContain('Forklaring');
  });

  it('skriver "ingen helligdage"-besked når perioden ikke indeholder helligdage', async () => {
    // Kort periode uden danske helligdage (midt i januar)
    const perioder = [
      { start: new Date(Date.UTC(2024, 0, 8)), end: new Date(Date.UTC(2024, 0, 12)) },
    ];

    const { filename, documentXml } = await renderWordDocument(() => {
      generateSHDagePdf(perioder, { visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('SH-dage');
    expect(text).toContain('Ingen helligdage fundet i de angivne perioder.');
  });
});
