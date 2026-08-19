// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { getSatserForYear } from '../../../data/lovbestemteRates';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for satser-dokumentet: kører den rigtige generator gennem
// Word-backenden og verificerer, at titel og satsindhold faktisk når .docx'en.
describe('satser → Word-indhold', () => {
  it('skriver titel og lovafsnit til .docx', async () => {
    const year = 2024;
    const { filename, documentXml } = await renderWordDocument((session) => {
      return generateSatserDocument(session, year, getSatserForYear(year), { visBrevhoved: false });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain(`Arbejdsskadesatser ${year}`);
    // Begge lovafsnit skal være til stede (EAL + ASL), ellers er der tabt indhold.
    expect(text).toMatch(/Erstatningsansvarsloven/i);
    expect(text).toMatch(/Arbejdsskadesikringsloven/i);
  });

  // BB-030: dokumentet udelod en sats på 0 %, som skærmen viste. Prøven var `> 0` i dokumentet og
  // «findes værdien» på siden, og de to var kun enige, så længe ingen sats var nul.
  // `reguleringsprocentErhvervsevnetabFra2024` er 0,0 i 2024 – det ene nul i hele satsdatasættet.
  it('skriver en sats på 0 % – et nul er en oplysning, ikke et fravær', async () => {
    const year = 2024;
    const satser = getSatserForYear(year);
    // Sikrer, at testen stadig måler det, den blev skrevet til: bliver 2024-satsen en dag ikke-nul,
    // skal denne test findes og flyttes til et år, der faktisk har et nul – ikke stille blive grøn.
    expect(satser.asl.reguleringProcentErhvervsevnetabFra2024).toBe(0);

    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, year, satser, { visBrevhoved: false })
    );

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('Reguleringsprocent for erhvervsevnetab (fra 2024)');
    expect(text).toContain('0 %');
    // Den anden reguleringsprocent samme år må stadig stå der; rettelsen tilføjer en række, den
    // fjerner ingen.
    expect(text).toContain('Reguleringsprocent for erhvervsevnetab (før 2024)');
  });

  // Rækker uden sats skal fortsat udgå. Ellers ville rettelsen ovenfor have gjort `null` til «0 kr.».
  it('udelader en sats, der ikke findes for året', async () => {
    const year = 2026;
    const satser = getSatserForYear(year);
    expect(satser.asl.aarsloenMinFoer2024).toBeNull();

    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, year, satser, { visBrevhoved: false })
    );

    const text = xmlToPlainText(documentXml);
    expect(text).not.toContain('Minimum årsløn (skader før 1.7.2024)');
    expect(text).toContain('Minimum årsløn');
  });

  it('inkluderer brevhoved-journalnr når brevhoved er slået til', async () => {
    const year = 2024;
    const { documentXml } = await renderWordDocument((session) => {
      return generateSatserDocument(session, year, getSatserForYear(year), {
        visBrevhoved: true,
        stamdata: { journalnr: '9988', advokat: 'AB', sagsbehandler: 'CD' } as never,
      });
    });

    const text = xmlToPlainText(documentXml);
    expect(text).toContain('9988');
  });
});
