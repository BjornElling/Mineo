// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { toISODateString } from '../../../types/branded';
import { createPdfDocumentSessionForTest } from './createPdfDocumentSession';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;

// Wiring-test for forsørgertab-PDF'en: verificerer at de betingede sider (EAL/ASL)
// kun bygges når den tilhørende delberegning er sat, så et manglende delgrundlag
// ikke fremtvinger en tom side eller en sektion uden indhold i et tillidskritisk dokument.
class MockJsPDF {
  static instances: MockJsPDF[] = [];
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  private currentFontName = 'helvetica';
  private currentFontStyle = 'normal';
  constructor() {
    MockJsPDF.instances.push(this);
  }
  setFont = vi.fn((name: string, style: string) => {
    this.currentFontName = name;
    this.currentFontStyle = style;
  });
  getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((t: string) => [t]);
  getTextWidth = vi.fn((t: string) => t.length);
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

const BASE_GRUNDLAEGGENDE = {
  beregningsdato: toISODateString('2026-03-17'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  skadedato: toISODateString('2020-05-01'),
  skadestype: 'Arbejdsulykke' as const,
  efterladteFodselsdato: undefined,
  koen: undefined,
  visKoenValg: false,
  aslAarsloen: undefined,
  ealAarsloen: undefined,
  virkningsdato: undefined,
  tilkendtForPeriodeAar: undefined,
};

// Generatoren importeres dynamisk inde i testene, så jspdf-mocken (med MockJsPDF)
// er fuldt initialiseret før modulgrafen indlæses. Eksplicit timeout, fordi den
// første dynamiske import af modulgrafen kan være tung under parallel kørsel.
const importGenerator = () => import('../../../document/generators/forsoergertab/forsoergertabDocument');

const renderedTextOf = (instance: MockJsPDF | undefined): unknown[] =>
  (instance?.text.mock.calls ?? []).map((call) => call[0]);

describe('forsoergertabPdf wiring', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it(
    'bygger hverken EAL- eller ASL-side når begge delberegninger er null',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();

      await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: BASE_GRUNDLAEGGENDE,
        result: null,
        ealComputation: null,
        aslComputation: null,
        foersoergertabEalMinSatsOre: null,
        foersoergertabForhoejtetTilMin: false,
        visBrevhoved: false,
      });

      const instance = MockJsPDF.instances.at(-1);
      const text = renderedTextOf(instance);

      expect(text).toContain('Forsørgertab');
      expect(text).not.toContain('EAL-krav');
      expect(text).not.toContain('ASL-ydelser');
      // Ingen ekstra sider når begge delberegninger mangler.
      expect(instance?.addPage).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'gemmer en PDF med korrekt filendelse',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();

      const artifact = await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: BASE_GRUNDLAEGGENDE,
        result: null,
        ealComputation: null,
        aslComputation: null,
        foersoergertabEalMinSatsOre: null,
        foersoergertabForhoejtetTilMin: false,
        visBrevhoved: false,
      });

      expect(artifact.filename).toMatch(/\.pdf$/);
    },
    20000
  );
});
