// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateKRLDocument } from '../../../document/generators/krl/krlDocument';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

const expectedRows = [
  ['01-04-2026', '65,3378 %', '45,0155 %', '19,8008 %', '19,8008 %'],
  ['01-10-2018', '37,7253 %', '20,7970 %', '2,0238 %', '2,0238 %'],
] as const;

describe('DATA-001/TD-020 – KRL-data som dokumentforbruger', () => {
  it('fører statiske KRL-facitter gennem den faktiske Word-generator', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateKRLDocument(session, { visBrevhoved: false })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('KRL Satstabeller');
    expect(text).toContain('Fra-dato');
    expect(text).toContain('KTO (kommuner)');
    expect(text).toContain('SHK (kommuner)');
    expect(text).toContain('KTO (regioner)');
    expect(text).toContain('SHK (regioner)');

    for (const row of expectedRows) {
      expect(text).toMatch(new RegExp(row.map((cell) => escapeRegExp(cell)).join('\\s*')));
    }
  });
});

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
