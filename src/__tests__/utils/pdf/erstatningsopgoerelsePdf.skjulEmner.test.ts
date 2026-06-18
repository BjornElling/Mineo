/// <reference types="vitest/globals" />
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues, JaNejSkjul } from '../../../schemas/formSchemas';
import { registerPdfWriterFallbackForTest } from './registerPdfWriterFallback';

class MockJsPDF {
  static lastInstance: MockJsPDF | null = null;
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  private currentFontName = 'helvetica';
  private currentFontStyle = 'normal';
  setFont = vi.fn((fontName: string, fontStyle: string) => {
    this.currentFontName = fontName;
    this.currentFontStyle = fontStyle;
  });
  getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((text: string) => [text]);
  getTextWidth = vi.fn((text: string) => text.length);
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();

  constructor() {
    MockJsPDF.lastInstance = this;
  }
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('../../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

describe('erstatningsopgoerelsePdf — Skjul udelader emner', () => {
  beforeEach(async () => {
    await registerPdfWriterFallbackForTest();
  });

  let generateErstatningsopgoerelseDocument: typeof import('../../../document/generators/eo/erstatningsopgoerelseDocument').generateErstatningsopgoerelseDocument;

  const selected = {
    opgoerelse: true,
    loenindkomst: false,
    offentligeYdelser: false,
    midlertidigEet: false,
    shDage: false,
    regulering: false,
    okSatser: false,
    sygeferiegodtgoerelse: false,
  };

  beforeAll(async () => {
    ({ generateErstatningsopgoerelseDocument } = await import('../../../document/generators/eo/erstatningsopgoerelseDocument'));
  }, 20000);

  beforeEach(() => {
    MockJsPDF.lastInstance = null;
  });

  const buildEo = (
    svieSmerte: JaNejSkjul,
    taf: JaNejSkjul,
    oevrigeKrav: JaNejSkjul = 'Nej'
  ): ErstatningsopgoerelseValues => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaSvieSmerteGodtgoerelse = svieSmerte;
    values.kravPaaTabtArbejdsfortjeneste = taf;
    values.kravPaaOevrigeErstatningskrav = oevrigeKrav;
    return values;
  };

  const render = (
    stamdata: StamdataValues,
    eo: ErstatningsopgoerelseValues,
    afsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje' | 'Ingen'
  ): string[] => {
    const snapshot = computeEoSnapshot({
      revision: 'pdf-skjul-test',
      stamdataValues: stamdata,
      eoValues: eo,
    });
    const projection = eoSnapshotToEoDocument(snapshot);
    if (projection.kind === 'blocked') {
      throw new Error(projection.message);
    }
    const document: EoModel = projection.document;
    generateErstatningsopgoerelseDocument(stamdata, eo, selected, {
      visUdkastStempel: false,
      document,
      ...(afsluttesMed ? { erstatningsopgoerelseAfsluttesMed: afsluttesMed } : {}),
    });
    return (MockJsPDF.lastInstance?.text.mock.calls ?? []).map((call) => String(call[0]));
  };

  it('viser overskrift + "Ingen" ved Nej, men udelader emnet helt ved Skjul', () => {
    const stamdata = structuredClone(STAMDATA_INITIAL_VALUES);

    const nejTexts = render(stamdata, buildEo('Nej', 'Nej', 'Nej'));
    expect(nejTexts).toContain('Svie- og smertegodtgørelse');
    expect(nejTexts).toContain('Tabt arbejdsfortjeneste');
    expect(nejTexts).toContain('Øvrige krav');

    const skjulTexts = render(stamdata, buildEo('Skjul', 'Skjul', 'Skjul'));
    expect(skjulTexts).not.toContain('Svie- og smertegodtgørelse');
    expect(skjulTexts).not.toContain('Tabt arbejdsfortjeneste');
    expect(skjulTexts).not.toContain('Øvrige krav');
  });

  it('skjuler kun det valgte emne — de andre emner vises stadig', () => {
    const stamdata = structuredClone(STAMDATA_INITIAL_VALUES);

    const texts = render(stamdata, buildEo('Skjul', 'Nej', 'Nej'));
    expect(texts).not.toContain('Svie- og smertegodtgørelse');
    expect(texts).toContain('Tabt arbejdsfortjeneste');
    expect(texts).toContain('Øvrige krav');

    const texts2 = render(stamdata, buildEo('Nej', 'Nej', 'Skjul'));
    expect(texts2).toContain('Svie- og smertegodtgørelse');
    expect(texts2).toContain('Tabt arbejdsfortjeneste');
    expect(texts2).not.toContain('Øvrige krav');
  });

  it('beholder Samlet erstatningskrav uden de skjulte emners linjer', () => {
    const stamdata = structuredClone(STAMDATA_INITIAL_VALUES);

    const texts = render(stamdata, buildEo('Skjul', 'Skjul', 'Skjul'));
    // Samlet-sektionen findes stadig, men uden de skjulte emners linjer.
    expect(texts).toContain('Samlet erstatningskrav');
    expect(texts).not.toContain('Øvrige krav');
    expect(texts).toContain('Erstatningskrav i alt');
  });

  it('udelader Godkendelse-afsnittet når afsluttesMed === "Ingen", men beholder det ved Underskrift-linje', () => {
    const stamdata = structuredClone(STAMDATA_INITIAL_VALUES);
    const eo = buildEo('Nej', 'Nej', 'Nej');

    const underskriftTexts = render(stamdata, eo, 'Underskrift-linje');
    expect(underskriftTexts).toContain('Godkendelse');

    const bekraeftetTexts = render(stamdata, eo, 'Bekræftet godkendt');
    expect(bekraeftetTexts).toContain('Godkendelse');

    const ingenTexts = render(stamdata, eo, 'Ingen');
    // "Ingen"-stien afsluttes ved det samlede krav og udelader hele godkendelses-afsnittet.
    expect(ingenTexts).toContain('Erstatningskrav i alt');
    expect(ingenTexts).not.toContain('Godkendelse');
  });
});
