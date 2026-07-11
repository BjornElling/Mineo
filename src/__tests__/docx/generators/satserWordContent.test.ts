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
