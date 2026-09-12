// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateKlLoenaftalerDocument } from '../../../document/generators/klLoenaftaler/klLoenaftalerDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedKlLoenaftalerRow = Readonly<{
  fraDato: string;
  regulering: string;
}>;

const expectedRows: readonly ExpectedKlLoenaftalerRow[] = [
  { fraDato: '01-04-2005', regulering: '0,00 %' },
  { fraDato: '01-04-2024', regulering: '4,00 %' },
  { fraDato: '01-10-2026', regulering: '0,50 %' },
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('DATA-001/TD-020 – KL-lønaftaler som dokumentforbruger', () => {
  it('fører statiske periodesatser gennem den faktiske Word-generator', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateKlLoenaftalerDocument(session, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('KL-lønaftaler');
    expect(text).toMatch(/Dato\s*Regulering/);

    for (const row of expectedRows) {
      expect(text).toMatch(new RegExp(`${escapeRegExp(row.fraDato)}\\s*${escapeRegExp(row.regulering)}`));
    }
  });
});
