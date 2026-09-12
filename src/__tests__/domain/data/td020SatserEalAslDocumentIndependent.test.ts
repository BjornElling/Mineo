// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { getSatserForYear } from '../../../data/lovbestemteRates';
import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedSatserRow = Readonly<{
  label: string;
  value: string;
}>;

// Håndskrevne 2024-facitter for de centrale EAL-/ASL-beløbsrækker. De allerede dækkede
// overgangsbeløb, fri-proces-grænser, referencer og reguleringsprocenter holdes udenfor denne
// partition, så testen kun beskytter den numeriske lovsatsdel af dokumentet.
const expectedSatserRows: readonly ExpectedSatserRow[] = [
  { label: 'Godtgørelse for svie og smerte', value: '230 kr./sygedag' },
  { label: 'Maksimum for svie og smerte', value: '88.500 kr.' },
  { label: 'Maksimum for erhvervsevnetabserstatning', value: '10.637.000 kr.' },
  { label: 'Mindstebeløb for forsørgertab', value: '1.138.000 kr.' },
  { label: 'Vejledende udtalelse om erhvervsevnetab', value: '24.390 kr.' },
  { label: 'Godtgørelse for varige mén', value: '10.135 kr./méngrad' },
  { label: 'Maksimum årsløn', value: '608.000 kr.' },
  { label: 'Minimum årsløn (skader før 1.7.2024)', value: '227.000 kr.' },
  { label: 'Minimum årsløn (skader fra 1.7.2024)', value: '257.000 kr.' },
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('DATA-001/TD-020 – EAL-/ASL-satser som dokumentforbruger', () => {
  it('fører statiske 2024-beløbsfacitter gennem den faktiske Word-generator', async () => {
    const year = 2024;
    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, year, getSatserForYear(year), { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('Erstatningsansvarsloven');
    expect(text).toContain('Arbejdsskadesikringsloven');
    for (const row of expectedSatserRows) {
      expect(text).toMatch(new RegExp(`${escapeRegExp(row.label)}\\s*${escapeRegExp(row.value)}`));
    }
  });
});
