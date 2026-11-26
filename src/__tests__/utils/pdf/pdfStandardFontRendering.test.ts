/// <reference types="vitest/globals" />

import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import { toISODateString } from '../../../types/branded';

/**
 * Ende-til-ende mod den RIGTIGE jsPDF: ét tegn uden for standardfontens
 * tegnsæt (fx «Ł») får jsPDF til at kode hele strengen som to-byte-tegn, så linjen vises som
 * spredte bogstaver. Testen læser den ukomprimerede PDF-strøm og kræver, at hver tekstlinje
 * er kodet som én byte pr. tegn – også i venstrejusterede tabelceller og brevhovedet.
 */
const renderedTextOperands = async (render: (writer: ReturnType<typeof createPdfChannelWriter>) => void): Promise<string[]> => {
  const writer = createPdfChannelWriter();
  render(writer);
  const bytes = new Uint8Array(await (await writer.build()).arrayBuffer());
  const stream = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return [...stream.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((match) => match[1] ?? '');
};

describe('PDF-tekst med tegn uden for standardfonten', () => {
  it('koder brevhoved, brødtekst og venstrejusterede tabelceller som én byte pr. tegn', async () => {
    const operands = await renderedTextOperands((writer) => {
      writer.writeBrevhoved({ journalnr: 'Żak-1', dagsDatoISO: toISODateString('2026-04-18') });
      writer.writeWrappedText('Łukasz Żak');
      writer.renderTable({
        columns: [{ width: { kind: 'flex' }, align: 'left' }, { width: { kind: 'auto' }, align: 'right' }],
        rows: [{ cells: [{ text: 'Łódź' }, { text: 'Żółć 100 kr.' }] }],
        hasHeaderRow: false,
      });
    });

    expect(operands).toEqual(expect.arrayContaining(['J.nr. Zak-1', 'Lukasz Zak']));
    // Ingen operand må være to-byte-kodet (NUL-byte foran hvert tegn = spredt linje).
    for (const operand of operands) {
      expect(operand.includes('\0'), JSON.stringify(operand)).toBe(false);
    }
    // ó er en del af standardfonten og bevares (Latin-1-byte 0xF3 i strømmen).
    const oAcute = String.fromCharCode(0xf3);
    const joined = operands.join('|');
    expect(joined).toContain(`L${oAcute}dz`);
    expect(joined).toContain(`Z${oAcute}lc`);
  });
});
