import type { DocumentBlock } from '../../document/model/documentModel';
import type {
  DocumentGenerationSession,
  DocumentRenderRequest,
} from '../../document/documentGenerationSession';
import { generateSHDageDocument } from '../../document/generators/aarsloen/shDageDocument';
import { createDate } from '../../utils/dateUtils';

const createFixtureSession = (): Readonly<{
  session: DocumentGenerationSession;
  requests: DocumentRenderRequest[];
}> => {
  const requests: DocumentRenderRequest[] = [];
  const session: DocumentGenerationSession = Object.freeze({
    format: 'pdf',
    render: async (request): Promise<Blob> => {
      requests.push(request);
      return new Blob();
    },
  });

  return { session, requests };
};

describe('DOC-001/DOC-003 – SH-dage-output fra håndskrevet helligdagsfacit', () => {
  it('skriver hverdagsmarkering, weekend-dæmpning og samlet SH-dagetotal i tabellen', async () => {
    const { session, requests } = createFixtureSession();
    const artifact = await generateSHDageDocument(
      session,
      [{ start: createDate(2024, 2, 28), end: createDate(2024, 3, 1) }],
    );

    expect(requests).toHaveLength(1);
    const model = requests[0]?.model;
    expect(model).toBeDefined();
    if (model === undefined) throw new Error('SH-dage-dokumentmodellen mangler');

    expect(model.blocks.filter((block) => block.kind === 'title')).toEqual([
      { kind: 'title', text: 'SH-dage' },
    ]);
    expect(model.blocks.filter((block) => block.kind === 'wrappedText').map((block) => block.text)).toEqual([
      'Periode: 28. marts 2024 - 1. april 2024',
      'Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).',
      'Helligdage, der falder i weekenden, fremgår af tabellen men medregnes ikke.',
    ]);

    const table = model.blocks.find((block): block is Extract<DocumentBlock, { kind: 'table' }> => block.kind === 'table');
    expect(table).toBeDefined();
    if (table === undefined) throw new Error('SH-dage-tabellen mangler');

    expect(table.spec.rows.map((row) => row.cells.map((cell) => cell.text))).toEqual([
      ['Ugedag', 'Dato', 'Helligdag', 'SH-dag'],
      ['Torsdag', '28. marts 2024', 'Skærtorsdag', 'x'],
      ['Fredag', '29. marts 2024', 'Langfredag', 'x'],
      ['Søndag', '31. marts 2024', 'Påskedag', ''],
      ['Mandag', '1. april 2024', 'Anden påskedag', 'x'],
      ['SH-dage i alt', '', '', '3'],
    ]);
    expect(table.spec.rows[3]).toMatchObject({ tone: 'muted' });
    expect(table.spec.rows.at(-1)?.cells[0]).toMatchObject({ bold: true });
    expect(model.blocks.at(-1)?.kind).toBe('footer');
    expect(artifact.filename).toBe('SH-dage (28-03-2024 - 01-04-2024).pdf');
  });
});
