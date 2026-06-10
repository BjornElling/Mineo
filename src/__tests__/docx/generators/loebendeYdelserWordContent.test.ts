/// <reference types="vitest/globals" />
import { generateLoebendeYdelserPdf } from '../../../pdf/domains/loebendeYdelser/loebendeYdelserPdf';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for løbende ydelser (EET): kører den RIGTIGE generator gennem
// Word-backenden. Tester både basis-stien og den udvidede specifikation, så den
// betingede slutside (visUdvidetSpecifikation) også dækkes for Word.
describe('loebendeYdelser → Word-indhold', () => {
  const computation = {
    beregningsdato: toISODateString('2026-03-17'),
    skadedato: toISODateString('2020-01-01'),
    fodselsdato: toISODateString('1980-01-01'),
    skadesaar: 2020,
    aslAarsloenAfrundet1000: 400000,
    maxAarsloenISkadesaar: 600000,
    benyttetAarsloen: 400000,
    grundloenNiveau: '2024',
    grundloen: 320000,
    erstatningsniveauPct: 80,
    amBidragPct: 8,
    reguleringFoer2024Pct: 0,
    afgoerelser: [],
  } as never;

  it('skriver titel til .docx (basis-sti uden udvidet specifikation)', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateLoebendeYdelserPdf({ computation, visUdvidetSpecifikation: false, visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('Løbende ydelser (EET)');
  });

  it('inkluderer udvidet specifikation når visUdvidetSpecifikation=true', async () => {
    const { documentXml } = await renderWordDocument(() => {
      generateLoebendeYdelserPdf({ computation, visUdvidetSpecifikation: true, visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Udvidet specifikation');
    expect(text).toContain('ASL årsløn');
  });
});
