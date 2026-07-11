import { defineDocument } from '../../document/generators/documentGeneratorSetup';
import { createDocumentGenerationSession } from '../../document/documentGenerationSession';
import type { DocumentWriter } from '../../document/writer';

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const createBuildOnlyWriter = (build: () => Promise<Blob>): DocumentWriter => ({
  setDisplayMode: () => {},
  setProperties: () => {},
  addFooter: () => {},
  build,
} as unknown as DocumentWriter);

describe('DocumentGenerationSession', () => {
  it('er immutable ved runtime og ikke kun i TypeScript-typen', () => {
    const session = createDocumentGenerationSession('pdf', () =>
      createBuildOnlyWriter(async () => new Blob())
    );

    expect(Object.isFrozen(session)).toBe(true);
  });

  it('isolerer samtidige formater og builds, også når de afsluttes i omvendt rækkefølge', async () => {
    const pdfBuild = createDeferred<Blob>();
    const wordBuild = createDeferred<Blob>();
    const pdfSession = createDocumentGenerationSession('pdf', () =>
      createBuildOnlyWriter(() => pdfBuild.promise)
    );
    const wordSession = createDocumentGenerationSession('word', () =>
      createBuildOnlyWriter(() => wordBuild.promise)
    );
    const generate = defineDocument<string>({
      title: 'Samtidighed',
      filename: (name) => `${name}.pdf`,
      writeTitle: false,
      body: () => {},
    });

    const pdfArtifactPromise = generate(pdfSession, 'pdf-dokument');
    const wordArtifactPromise = generate(wordSession, 'word-dokument');

    const wordBlob = new Blob(['word']);
    wordBuild.resolve(wordBlob);
    await expect(wordArtifactPromise).resolves.toEqual({
      blob: wordBlob,
      filename: 'word-dokument.docx',
    });

    const pdfBlob = new Blob(['pdf']);
    pdfBuild.resolve(pdfBlob);
    await expect(pdfArtifactPromise).resolves.toEqual({
      blob: pdfBlob,
      filename: 'pdf-dokument.pdf',
    });
  });
});
