// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { getSatserForYear } from '../../../data/lovbestemteRates';
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedSatserRow = Readonly<{
  label: string;
  value: string;
}>;

const expectedRow: ExpectedSatserRow = {
  label: 'Reguleringsprocent for erhvervsevnetab',
  value: '60,1 %',
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('DATA-001/TD-020 – erhvervsevnetab-reguleringsprocent som Satser-dokumentforbruger', () => {
  it('fører det statiske 2023-facit gennem den faktiske Word-generator', async () => {
    const satser = getSatserForYear(2023);

    // Uafhængigt transformationsfacit: 2023-rækken er den sidste i den historiske serie.
    expect(satser.asl.reguleringProcentErhvervsevnetab).toBe(60.1);

    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, 2023, satser, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toMatch(new RegExp(`${escapeRegExp(expectedRow.label)}\\s*${escapeRegExp(expectedRow.value)}`));
  });
});
