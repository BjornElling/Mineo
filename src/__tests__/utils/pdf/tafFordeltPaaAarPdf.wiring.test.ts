// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { TafPerYearDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearDocument';
import { toISODateString } from '../../../types/branded';
import { registerPdfWriterFallbackForTest } from './registerPdfWriterFallback';

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

const FAKE_MODEL = {
  brevhoved: null,
  periodeDisplay: '01-01-2024 - 31-12-2024',
  skadelidteNavn: 'Test Person',
  skadestypeLinje: 'Arbejdsulykke den 1. januar 2024',
  forlig: { erIndgaaet: false, label: null, dato: null, factor: null },
  tabtArbejdsfortjeneste: {
    beregnes: true,
    statusLinjer: ['Status: aktiv'],
    eetLinjer: [],
    differencekravLinje: null,
    harTafPerioder: true,
    tafPerioderLinjer: ['01-01-2024 - 31-12-2024'],
  },
};

const FAKE_RESULT: TafPerYearResult = {
  years: [
    {
      year: 2024,
      segments: [
        {
          fra: toISODateString('2024-01-02') as any,
          til: toISODateString('2024-12-31') as any,
          kind: 'arbejdsdage',
          quantity: 250,
          sourceLabel: 'Timeløn',
          unitAmountOre: 200000 as MoneyOre,
          deltaPct: 0,
          amountOre: 50000000 as MoneyOre,
        },
      ],
      deductions: [
        { label: 'Sygedagpenge', amountOre: 10000000 as MoneyOre },
      ],
      yearIncomeOre: 50000000 as MoneyOre,
      yearDeductionsOre: 10000000 as MoneyOre,
      // "Allerede betalt TAF" bæres separat (uden for forlig-faktoren), ikke i deductions.
      yearTidligereModtagetTafOre: 2500000 as MoneyOre,
      yearTafFoerForligOre: 40000000 as MoneyOre,
      yearTafOre: 37500000 as MoneyOre,
    },
  ],
  sumYearTafOre: 37500000 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 37500000 as MoneyOre,
};

const FAKE_DOCUMENT: TafPerYearDocument = {
  model: FAKE_MODEL as never,
  presentation: FAKE_RESULT,
};

describe('tafFordeltPaaAarPdf wiring', () => {
  beforeEach(async () => {
    await registerPdfWriterFallbackForTest();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('kræver et præ-projiceret dokument fra snapshot-laget', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    expect(() => generateTafFordeltPaaAarDocument(undefined as never)).toThrow();
  });

  it('genbruger givet dokument uden at kræve rå snapshot-input', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    expect(() => generateTafFordeltPaaAarDocument({ document: FAKE_DOCUMENT })).not.toThrow();
  });

  it('kaster ikke fejl når dokumentet indeholder null-presentation', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    expect(() =>
      generateTafFordeltPaaAarDocument({
        document: {
          model: FAKE_MODEL as never,
          presentation: null,
        },
      })
    ).not.toThrow();
  });

  it('viser ikke tom status-underoverskrift når statusblokken er uden indhold', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: {
          ...FAKE_MODEL,
          tabtArbejdsfortjeneste: {
            ...FAKE_MODEL.tabtArbejdsfortjeneste,
            statusLinjer: [],
            eetLinjer: [],
            differencekravLinje: null,
            harTafPerioder: false,
            tafPerioderLinjer: [],
          },
        } as never,
        presentation: null,
      },
    });

    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).not.toContain('Status');
    expect(renderedText).toContain('Erstatningsperiode med tabt arbejdsfortjeneste');
    expect(renderedText).toContain('TAF fordelt på kalenderår');
    expect(renderedText.filter((text) => text === 'Ingen')).toHaveLength(2);
  });

  it('gemmer PDF med korrekt filnavn', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({ document: FAKE_DOCUMENT });
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeInstanceOf(MockJsPDF);
    expect(instance?.save).toHaveBeenCalledWith('Tabt arbejdsfortjeneste fordelt på år.pdf');
  });

  it('gemmer PDF med udkast-suffix når visUdkastStempel=true', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: FAKE_DOCUMENT,
      visUdkastStempel: true,
    });
    const instance = MockJsPDF.instances.at(-1);
    expect(instance?.save).toHaveBeenCalledWith('Tabt arbejdsfortjeneste fordelt på år (udkast).pdf');
  });

  it('prepender journalnr i filnavn når journalnr er udfyldt', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: {
          ...FAKE_MODEL,
          brevhoved: { journalnr: '1234' },
        } as never,
        presentation: FAKE_RESULT,
      },
      visUdkastStempel: true,
    });
    const instance = MockJsPDF.instances.at(-1);
    expect(instance?.save).toHaveBeenCalledWith('1234 - Tabt arbejdsfortjeneste fordelt på år (udkast).pdf');
  });

  it('viser negativt beløb for negativt I alt pr. år', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: FAKE_MODEL as never,
        presentation: {
          ...FAKE_RESULT,
          years: [{ ...FAKE_RESULT.years[0], yearTafOre: (-5000) as MoneyOre }],
        },
      },
    });
    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('- 50,00 kr.');
  });

  it('renderer "Allerede betalt TAF" som fradragslinje', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({ document: FAKE_DOCUMENT });
    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Allerede betalt TAF');
    expect(renderedText).toContain('- 25.000,00 kr.');
  });

  it('renderer sygeferiegodtgørelse som fradragslinje når den er valgt i årsfordelingen', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: FAKE_MODEL as never,
        presentation: {
          ...FAKE_RESULT,
          years: [{
            ...FAKE_RESULT.years[0],
            deductions: [
              ...FAKE_RESULT.years[0].deductions,
              { label: 'Sygeferiegodtgørelse', amountOre: 40000 as MoneyOre },
            ],
          }],
        },
      },
    });
    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Sygeferiegodtgørelse');
    expect(renderedText).toContain('- 400,00 kr.');
  });

  it('renderer valgt sygeferiegodtgørelse med 0 kr. uden minus-prefix', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: FAKE_MODEL as never,
        presentation: {
          ...FAKE_RESULT,
          years: [{
            ...FAKE_RESULT.years[0],
            deductions: [
              { label: 'Sygeferiegodtgørelse', amountOre: 0 as MoneyOre },
            ],
          }],
        },
      },
    });
    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Sygeferiegodtgørelse');
    expect(renderedText).toContain('0,00 kr.');
    expect(renderedText).not.toContain('- 0,00 kr.');
  });

  it('viser forlig-sektion og forlig-reference i "I alt"-linjen når forlig er indgået', async () => {
    const { generateTafFordeltPaaAarDocument } = await import('../../../document/generators/tafFordelt/tafFordeltPaaAarDocument');

    generateTafFordeltPaaAarDocument({
      document: {
        model: {
          ...FAKE_MODEL,
          forlig: { erIndgaaet: true, label: '50%', dato: toISODateString('2024-04-01'), factor: 0.5 },
        } as never,
        presentation: {
          ...FAKE_RESULT,
          years: [
            {
              ...FAKE_RESULT.years[0],
              yearTidligereModtagetTafOre: 0 as MoneyOre,
              yearTafFoerForligOre: 37500000 as MoneyOre,
              yearTafOre: 18750000 as MoneyOre,
            },
          ],
        },
      },
    });
    const instance = MockJsPDF.instances.at(-1);
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Forlig');
    expect(renderedText.some((text) => String(text).includes('indgået forlig i sagen på betaling af 50%.'))).toBe(true);
    expect(renderedText.some((text) => String(text).includes('I alt (50% af'))).toBe(true);
    expect(renderedText).toContain('187.500,00 kr.');
  });
});
