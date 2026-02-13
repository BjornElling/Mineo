import { describe, expect, it, vi } from 'vitest';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const MockJsPDF = vi.hoisted(() =>
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
);

vi.mock('jspdf', () => ({ default: MockJsPDF }));

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const selected = {
  opgoerelse: true,
  loenindkomst: false,
  offentligeYdelser: false,
  shDage: false,
  regulering: false,
  okSatser: false,
  sygeferiegodtgoerelse: false,
};

const collectTextStrings = (instance: MockJsPDF | null): string[] => {
  if (!instance) return [];
  const values: string[] = [];
  for (const call of instance.text.mock.calls) {
    const [firstArg] = call;
    if (typeof firstArg === 'string') {
      values.push(firstArg);
      continue;
    }
    if (Array.isArray(firstArg)) {
      for (const item of firstArg) {
        if (typeof item === 'string') values.push(item);
      }
    }
  }
  return values;
};

const buildBaseInput = () => {
  const stamdata = {
    ...structuredClone(STAMDATA_INITIAL_VALUES),
    skadestype: 'Arbejdsulykke' as const,
    skadesdato: iso('2024-01-01'),
  };

  const eo = createErstatningsopgoerelseInitialValues();
  eo.beregnesUdFra = 'Beregningsperiode';
  eo.vedroererPeriodeFra = iso('2024-01-01');
  eo.vedroererPeriodeTil = iso('2024-01-31');
  eo.periodeTilBeregningFra = iso('2024-01-01');
  eo.periodeTilBeregningTil = iso('2024-01-31');
  eo.tafPerioder = [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-31'), loseFeriedage: undefined }];

  eo.loenindkomstAnsaettelsesforhold = [
    {
      ...eo.loenindkomstAnsaettelsesforhold[0],
      id: 'af-1',
      navnPaaArbejdssted: 'AAB',
      loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
          col2: asAmountValue(10000),
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
    },
  ];

  return { stamdata, eo };
};

describe('erstatningsopgoerelsePdf indkomst-breakdown synlighed', () => {
  let generateErstatningsopgoerelsePdf: typeof import('../../../utils/pdf/erstatningsopgoerelsePdf').generateErstatningsopgoerelsePdf;

  beforeAll(async () => {
    const pdfModule = await import('../../../utils/pdf/erstatningsopgoerelsePdf');
    generateErstatningsopgoerelsePdf = pdfModule.generateErstatningsopgoerelsePdf;
  });

  it('skjuler pensionslinje når beregnet værdi er 0 kr.', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 15;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = asAmountValue(1500);

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts).not.toContain('Arbejdsgivers pensionsbidrag');
    expect(texts).toContain('Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg');
  });

  it('skjuler "I alt:" når kun én del-linje vises', () => {
    const { stamdata, eo } = buildBaseInput();
    eo.loenindkomstAnsaettelsesforhold[0].feriePct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].fritvalgPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].shSoPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].storeBededagPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].pensionPct = 0;
    eo.loenindkomstAnsaettelsesforhold[0].indtaegtsoplysningerTableData[0].col5 = undefined;

    generateErstatningsopgoerelsePdf(stamdata, eo, selected, { visUdkastStempel: false });
    const texts = collectTextStrings(MockJsPDF.lastInstance);

    expect(texts.filter((text) => text === 'I alt:')).toHaveLength(0);
  });
});
