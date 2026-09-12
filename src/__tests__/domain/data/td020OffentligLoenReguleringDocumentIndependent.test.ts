// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { generateReguleringDocument } from '../../../document/generators/eo/reguleringDocument';
import type { DanishDateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from '../../docx/generators/wordContentHarness';

type ExpectedSalaryRow = Readonly<{
  fraDato: string;
  maanedsloen: string;
  timeloen: string;
}>;

// Håndskrevet facit for RLTN, løntrin 42, gruppe 4. De tre rækker følger
// periodeopslagets carry-forward ved start 01-03-2024 og dokumentets nyeste-først-sortering.
const expectedRows: readonly ExpectedSalaryRow[] = [
  { fraDato: '01-10-2024', maanedsloen: '37.505,92', timeloen: '233,92' },
  { fraDato: '01-04-2024', maanedsloen: '36.991,75', timeloen: '230,72' },
  { fraDato: '01-10-2023', maanedsloen: '35.568,92', timeloen: '221,84' },
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('DATA-001/TD-020 – offentlig lønperiode som reguleringsdokument-forbruger', () => {
  it('fører statiske RLTN-facitter gennem den faktiske Word-generator', async () => {
    const { documentXml } = await renderWordDocument((session) =>
      generateReguleringDocument(session, {
        overenskomstLabel: 'RLTN (Regioner)',
        loenudviklingBasis: 'Overenskomst',
        overenskomstId: 'rltn-overenskomst',
        statistikModelLabel: undefined,
        interval: {
          fraDato: '01-03-2024' as DanishDateString,
          tilDato: '01-12-2024' as DanishDateString,
        },
        applyAlmindeligLoenPaaShDageRegel: false,
        offentligLoenType: 'Månedsløn',
        offentligLoenTrin: 42,
        offentligLoenGruppe: 4,
        visBrevhoved: false,
      })
    );
    const text = xmlToPlainText(documentXml);

    expect(text).toContain('RLTN (Regioner)');
    expect(text).toContain('Løntrin 42, Gruppe 4');
    expect(text).toMatch(/Fra-dato\s*Månedsløn\s*Timeløn/);

    for (const row of expectedRows) {
      expect(text).toMatch(new RegExp(
        `${escapeRegExp(row.fraDato)}\\s*${escapeRegExp(row.maanedsloen)}\\s*${escapeRegExp(row.timeloen)}`
      ));
    }
  });
});
