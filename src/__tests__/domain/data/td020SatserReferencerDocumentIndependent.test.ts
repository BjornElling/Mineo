// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateSatserDocument } from '../../../document/generators/satser/satserDocument';
import { getSatserForYear } from '../../../data/lovbestemteRates';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedReferenceRow = Readonly<{
  label: string;
  value: string;
}>;

const expectedReferenceRows: readonly ExpectedReferenceRow[] = [
  { label: 'Erstatningsansvarsloven', value: 'Bkg. 1390/2023' },
  { label: 'Arbejdsskadesikringsloven', value: 'Vejl. 9822/2023' },
  {
    label: 'Kapitalisering (skade fra 1.1.2011)',
    value: 'Vejl. 9820/2023 og Vejl. 9376/2024',
  },
  {
    label: 'Kapitalisering (skade før 1.1.2011)',
    value: 'Vejl. 9871/2020 og Vejl. 9376/2024',
  },
  { label: 'Fri proces', value: 'Bkg. 1521/2023' },
  { label: 'Reguleringssatser', value: 'Bkg. 1101/2023' },
];

describe('DATA-001/TD-020 – satsreferencer som dokumentforbruger', () => {
  it('fører statiske 2024-referencefacitter gennem den faktiske Word-generator', async () => {
    const year = 2024;
    const { documentXml } = await renderWordDocument((session) =>
      generateSatserDocument(session, year, getSatserForYear(year), { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('Referencer');
    for (const row of expectedReferenceRows) {
      expect(text).toMatch(new RegExp(`${escapeRegExp(row.label)}\\s*${escapeRegExp(row.value)}`));
    }
  });
});

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
