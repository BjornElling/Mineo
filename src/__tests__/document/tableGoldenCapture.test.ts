import { extractWordTables } from './tableGoldenCapture';

describe('extractWordTables', () => {
  it('udtrækker hele den ydre tabel, når den indeholder en indlejret tabel', () => {
    const outerTable = '<w:tbl><w:tr><w:tc><w:tbl><w:tr/></w:tbl><w:p>efter</w:p></w:tc></w:tr></w:tbl>';
    const secondTable = '<w:tbl><w:tr><w:tc>næste</w:tc></w:tr></w:tbl>';

    expect(extractWordTables(`<w:document>${outerTable}${secondTable}</w:document>`)).toEqual([
      outerTable,
      secondTable,
    ]);
  });
});
