// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { getSatserForYear } from '../../../data/lovbestemteRates';
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

describe('DATA-001/TD-020 – fri proces som Satser-dokument-forbruger', () => {
  it('fører de statiske 2025-grænser gennem den faktiske Word-generator', async () => {
    const satser = getSatserForYear(2025);

    // Statisk håndfacit fra 2025-satserne: 385.000 kr. for enlig,
    // 490.000 kr. for samlevende og 67.000 kr. pr. barn under 18 år.
    expect(satser.diverse.friProcesEnlig).toBe(385000);
    expect(satser.diverse.friProcesSamlevende).toBe(490000);
    expect(satser.diverse.friProcesBarn).toBe(67000);

    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, 2025, satser, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('Beløbsgrænse for fri proces');
    expect(text).toContain('385.000 kr. (enlig) / 490.000 kr. (samlevende)');
    expect(text).toContain('+ 67.000 kr. per barn under 18 år');
  });
});
