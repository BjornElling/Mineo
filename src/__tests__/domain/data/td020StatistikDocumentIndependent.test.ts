// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateReguleringDocument } from '../../../document/generators/eo/reguleringDocument';
import type { DanishDateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedIndexRow = Readonly<{
  kvartal: string;
  startdato: string;
  indeks: string;
}>;

const expectedIndexRows: readonly ExpectedIndexRow[] = [
  { kvartal: '2025K1', startdato: '01-01-2025', indeks: '161,5' },
  { kvartal: '2025K4', startdato: '01-10-2025', indeks: '165,2' },
];

describe('DATA-001/TD-020 – ILON12 som reguleringsdokument-forbruger', () => {
  it('fører de statiske 2025-indeks gennem den faktiske Word-generator', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateReguleringDocument(session, {
        overenskomstLabel: '',
        loenudviklingBasis: 'Statistik',
        overenskomstId: undefined,
        statistikModelLabel: 'ILON12 (Danmarks Statistik)',
        interval: {
          fraDato: '01-01-2025' as DanishDateString,
          tilDato: '31-12-2025' as DanishDateString,
        },
        applyAlmindeligLoenPaaShDageRegel: false,
        visBrevhoved: false,
      })
    );

    const text = xmlToPlainText(documentXml);

    for (const row of expectedIndexRows) {
      expect(text).toContain(`${row.kvartal}${row.startdato}${row.indeks}`);
    }
  });
});
