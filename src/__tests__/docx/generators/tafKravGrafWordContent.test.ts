// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { renderWordDocument } from './wordContentHarness';

// Word-indholdstest for "Visuel graf over indtægtsniveau": grafen tegnes på et
// HTML-canvas, som jsdom ikke understøtter. Diagrammet er et SEPARAT,
// format-agnostisk modul (tafKravGrafChart) der testes for sig; her mocker vi
// PNG-rendereren til et 1x1-billede, så vi i stedet kan verificere DET, der er
// Word-generatorens ansvar: at dokumentet får titlen (core-properties) og at
// grafen faktisk indlejres som et billede i .docx-pakken (word/media).
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

vi.mock('../../../document/generators/tafFordelt/tafKravGrafChart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../document/generators/tafFordelt/tafKravGrafChart')>();
  return { ...actual, renderTafKravGrafChartPng: () => PNG_1X1 };
});

const FAKE_DOCUMENT_BASE = {
  model: { titel: 'Visuel graf over indtægtsniveau', brevhoved: null },
  unit: 'maaned',
  series: [],
  timeWindows: [],
  beregningsperiode: null,
  skadeMarker: null,
};

const FAKE_DOCUMENT = FAKE_DOCUMENT_BASE as never;

describe('tafKravGraf → Word-indhold', () => {
  it('indlejrer grafen som billede og sætter dokumenttitlen i .docx', async () => {
    const { generateTafKravGrafDocument } = await import('../../../document/generators/tafFordelt/tafKravGrafDocument');

    const { filename, zip } = await renderWordDocument(() => {
      generateTafKravGrafDocument({ document: FAKE_DOCUMENT, visBrevhoved: false });
    });

    expect(filename).toMatch(/\.docx$/);
    // Titlen sættes som core-property (writeTitle kaldes ikke for grafen).
    const coreXml = (await zip.file('docProps/core.xml')?.async('string')) ?? '';
    expect(coreXml).toContain('Visuel graf over indtægtsniveau');
    // Grafen skal være indlejret som et billede i pakken.
    const mediaFiles = Object.keys(zip.files).filter((name) => /^word\/media\//.test(name));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('bruger liggende side og placerer brevhovedruden efter landscape-bredden', async () => {
    const { generateTafKravGrafDocument } = await import('../../../document/generators/tafFordelt/tafKravGrafDocument');

    const documentWithBrevhoved = {
      ...FAKE_DOCUMENT_BASE,
      model: {
        titel: 'Visuel graf over indtægtsniveau',
        brevhoved: {
          journalnr: '123',
          advokat: 'AB',
          sagsbehandler: 'CD',
          dagsDatoISO: '2026-06-29',
        },
      },
    } as never;
    const { documentXml } = await renderWordDocument(() => {
      generateTafKravGrafDocument({ document: documentWithBrevhoved, visBrevhoved: true });
    });

    expect(documentXml).toContain('w:orient="landscape"');
    expect(documentXml).toContain('w:w="16838"');
    expect(documentXml).toContain('w:h="11906"');
    const frameX = Number(/<w:framePr\b[^>]*\bw:x="(\d+)"/.exec(documentXml)?.[1] ?? 0);
    expect(frameX).toBeGreaterThan(11_000);
  });
});
