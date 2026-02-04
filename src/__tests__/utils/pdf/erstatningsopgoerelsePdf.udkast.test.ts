/// <reference types="vitest/globals" />

const mockInstances: MockJsPDF[] = [];

class MockJsPDF {
  static lastInstance: MockJsPDF | null = null;
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  setFont = vi.fn();
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((text: string) => [text]);
  getTextWidth = vi.fn((text: string) => text.length);
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();

  constructor() {
    MockJsPDF.lastInstance = this;
    mockInstances.push(this);
  }
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

describe('erstatningsopgoerelsePdf udkaststempel', () => {
  const { STAMDATA_INITIAL_VALUES } = await import('../../../domain/stamdata/stamdataInitialValues');
  const { createErstatningsopgoerelseInitialValues } = await import('../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues');
  const { generateErstatningsopgoerelsePdf, resolveUdkastStempelValue } = await import('../../../utils/pdf/erstatningsopgoerelsePdf');

  const baseStamdata = structuredClone(STAMDATA_INITIAL_VALUES);
  const baseEo = createErstatningsopgoerelseInitialValues();
  const selected = {
    opgoerelse: true,
    loenindkomst: false,
    offentligeYdelser: false,
    shDage: false,
    regulering: false,
    okSatser: false,
    sygeferiegodtgoerelse: false,
  };

  const hasUdkastCall = (instance: MockJsPDF | null): boolean => {
    if (!instance) return false;
    return instance.text.mock.calls.some((call) => {
      const [text, , , options] = call;
      return text === 'UDKAST' && options && options.angle === -45;
    });
  };

  it('indsætter udkaststempel når visUdkastStempel=true', () => {
    generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selected, { visUdkastStempel: true });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(true);
  });

  it('indsætter ikke udkaststempel når visUdkastStempel=false', () => {
    generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selected, { visUdkastStempel: false });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(false);
  });

  it('resolverer manglende indsaetUdkastStempel som false', () => {
    expect(resolveUdkastStempelValue(undefined)).toBe(false);
  });
});
