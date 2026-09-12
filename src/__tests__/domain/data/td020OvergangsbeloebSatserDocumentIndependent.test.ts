// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { getSatserForYear } from '../../../data/lovbestemteRates';
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

describe('DATA-001/TD-020 – overgangsbeløb som Satser-dokument-forbruger', () => {
  it('fører det statiske 2025-facit gennem den faktiske Word-generator', async () => {
    const satser = getSatserForYear(2025);

    // Statisk håndfacit: overgangsbeløbet i 2025 er 198.500 kr.
    expect(satser.asl.overgangsbelob).toBe(198500);

    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, 2025, satser, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('Overgangsbeløb');
    expect(text).toContain('198.500 kr.');
  });
});
