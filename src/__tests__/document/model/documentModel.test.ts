import { createDocumentComposer, renderDocumentModel } from '../../../document/model/documentModel';
import type { DocumentWriter } from '../../../document/writer';
import { getToday } from '../../../config/dateRanges';
import { PDF_BASE_LINE_HEIGHT_MM, PDF_LINE_BOTTOM_SPACING_MM } from '../../../document/layout/pdfConfig';

type RecordedCall = Readonly<{ name: string; args: readonly unknown[] }>;

const createRecordingTarget = (): Readonly<{
  writer: DocumentWriter;
  calls: RecordedCall[];
}> => {
  const calls: RecordedCall[] = [];
  const record = (name: string, ...args: readonly unknown[]): void => {
    calls.push({ name, args });
  };

  const writer: DocumentWriter = {
    setProperties: (...args) => record('setProperties', ...args),
    keepWithNext: (...args) => record('keepWithNext', ...args),
    keepLastLineWithNext: (...args) => record('keepLastLineWithNext', ...args),
    addSpacer: (...args) => record('addSpacer', ...args),
    addSectionSpacer: (...args) => record('addSectionSpacer', ...args),
    writeWrappedText: (...args) => record('writeWrappedText', ...args),
    writeBoldWrappedText: (...args) => record('writeBoldWrappedText', ...args),
    writeWrappedTextContinued: (...args) => record('writeWrappedTextContinued', ...args),
    writeNormalThenBoldLine: (...args) => record('writeNormalThenBoldLine', ...args),
    writeLeftRightText: (...args) => record('writeLeftRightText', ...args),
    writeSectionHeader: (...args) => record('writeSectionHeader', ...args),
    writeTitle: (...args) => record('writeTitle', ...args),
    writeBoldSubheader: (...args) => record('writeBoldSubheader', ...args),
    writeBoldSubheaderIfContent: (params) => {
      record('writeBoldSubheaderIfContent', params.text);
      if (!params.hasContent) return false;
      params.renderContent();
      return true;
    },
    writeBoldSubheaderWithWrappedText: (...args) =>
      record('writeBoldSubheaderWithWrappedText', ...args),
    writeAtomicTableChunks: (params) => {
      record('writeAtomicTableChunks', params.estimateRowHeight, params.headerHeight);
      params.renderHeader();
      for (const row of params.rows) params.renderRow(row);
    },
    writeUnderlinedSubheader: (...args) => record('writeUnderlinedSubheader', ...args),
    writeSignatureBlock: (...args) => record('writeSignatureBlock', ...args),
    writeBrevhoved: (...args) => record('writeBrevhoved', ...args),
    addUdkastWatermark: (...args) => record('addUdkastWatermark', ...args),
    addContentWidthImage: (...args) => record('addContentWidthImage', ...args),
    renderTable: (...args) => record('renderTable', ...args),
    addPage: (...args) => record('addPage', ...args),
    addFooter: (...args) => record('addFooter', ...args),
    build: async () => new Blob(),
  };

  return { writer, calls };
};

describe('documentModel', () => {
  it('bygger en immutable, kanalneutral bloksekvens', () => {
    const { composer, build } = createDocumentComposer();

    composer.writeTitle('Opgørelse');
    composer.writeLeftRightText('Beløb', '1.000 kr.', {
      rightFontStyle: 'bold',
      minRightColumnWidthText: '000.000.000,00',
    });
    composer.addPage();

    const model = build();

    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.blocks)).toBe(true);
    expect(model.blocks.every(Object.isFrozen)).toBe(true);
    expect(model.blocks).toEqual([
      { kind: 'title', text: 'Opgørelse', trailingSpacing: undefined },
      {
        kind: 'labelValue',
        label: 'Beløb',
        value: '1.000 kr.',
        options: {
          rightFontStyle: 'bold',
          minRightColumnWidthText: '000.000.000,00',
        },
      },
      { kind: 'pageBreak' },
    ]);
  });

  it('udelader tomme betingede afsnit og indlejrer indholdet i ikke-tomme afsnit', () => {
    const { composer, build } = createDocumentComposer();

    expect(
      composer.writeBoldSubheaderIfContent({
        text: 'Tomt',
        hasContent: false,
        renderContent: () => {
          composer.writeWrappedText('Må ikke bygges');
          return undefined;
        },
      }),
    ).toBe(false);
    expect(
      composer.writeBoldSubheaderIfContent({
        text: 'Indhold',
        hasContent: true,
        renderContent: () => {
          composer.writeWrappedText('En linje');
          return undefined;
        },
      }),
    ).toBe(true);

    expect(build().blocks).toEqual([
      {
        kind: 'conditionalSubsection',
        text: 'Indhold',
        addTopSpacing: undefined,
        blocks: [{ kind: 'wrappedText', text: 'En linje' }],
      },
    ]);
  });

  it('materialiserer atomiske rækker som data før rendering', () => {
    const { composer, build } = createDocumentComposer();

    composer.writeAtomicTableChunks({
      rows: ['A', 'B'],
      renderHeader: () => {
        composer.writeBoldSubheader('Header');
        return undefined;
      },
      renderRow: (row) => {
        composer.writeWrappedText(row);
        return undefined;
      },
      estimateRowHeight: 6,
      headerHeight: 8,
    });

    expect(build().blocks).toEqual([
      {
        kind: 'atomicChunks',
        header: [
          {
            kind: 'boldSubheader',
            text: 'Header',
            addTopSpacing: undefined,
          },
        ],
        rows: [
          [{ kind: 'wrappedText', text: 'A' }],
          [{ kind: 'wrappedText', text: 'B' }],
        ],
        estimateRowHeight: 6,
        headerHeight: 8,
      },
    ]);
  });

  it('kopierer og deep-freezer payload uden at fryse kalderens objekter', () => {
    const { composer, build } = createDocumentComposer();
    const spec = {
      columns: [{ width: { kind: 'flex' as const } }],
      rows: [{ cells: [{ text: 'Værdi' }] }],
      hasHeaderRow: false,
    };

    composer.addTable(spec);
    const model = build();
    const table = model.blocks[0];

    expect(Object.isFrozen(spec)).toBe(false);
    expect(Object.isFrozen(spec.columns)).toBe(false);
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') throw new Error('Forventede en tabelblok');
    expect(table.spec).not.toBe(spec);
    expect(Object.isFrozen(table.spec)).toBe(true);
    expect(Object.isFrozen(table.spec.columns)).toBe(true);
    expect(Object.isFrozen(table.spec.rows[0])).toBe(true);
  });

  it('dispatcher hver bloktype præcis én gang til det interne render-target', () => {
    const { composer, build } = createDocumentComposer();
    const { writer, calls } = createRecordingTarget();

    composer.writeWrappedText('Normal');
    composer.writeBoldWrappedText('Fed');
    composer.writeWrappedTextContinued('Fortsat');
    composer.writeNormalThenBoldLine('Normal del', 'Fed del');
    composer.writeLeftRightText('Label', 'Værdi', { minRightColumnWidthText: '000' });
    composer.writeSectionHeader('Sektion');
    composer.writeTitle('Titel', { trailingSpacing: 3 });
    composer.writeBoldSubheader('Underoverskrift', { addTopSpacing: false });
    composer.writeBoldSubheaderIfContent({
      text: 'Betinget',
      hasContent: true,
      renderContent: () => {
        composer.writeWrappedText('Betinget indhold');
        return undefined;
      },
    });
    composer.writeBoldSubheaderWithWrappedText('Samlet', 'Brødtekst');
    composer.writeAtomicTableChunks({
      rows: ['Række'],
      renderHeader: () => {
        composer.writeUnderlinedSubheader('Header');
        return undefined;
      },
      renderRow: (row) => {
        composer.writeWrappedText(row);
        return undefined;
      },
      estimateRowHeight: 6,
      headerHeight: 9,
    });
    composer.addSectionSpacer();
    composer.keepWithNext(11);
    composer.addPage();
    composer.addTable({
      columns: [{ width: { kind: 'flex' } }],
      rows: [{ cells: [{ text: 'Celle' }] }],
      hasHeaderRow: false,
    });
    composer.writeSignatureBlock('Dato', 'Signatur', 'Skadelidte', 13);
    composer.writeBrevhoved({ journalnr: 'J-1', dagsDatoISO: getToday() });
    composer.addUdkastWatermark();
    composer.addContentWidthImage('data:image/png;base64,AA==', {
      aspectRatio: 2,
      maxHeight: 30,
      verticalPadding: 3,
    });
    composer.addFooter();

    renderDocumentModel(writer, build());

    const callCount = (name: string): number => calls.filter((call) => call.name === name).length;
    for (const name of [
      'writeBoldWrappedText',
      'writeWrappedTextContinued',
      'writeNormalThenBoldLine',
      'writeLeftRightText',
      'writeSectionHeader',
      'writeTitle',
      'writeBoldSubheader',
      'writeBoldSubheaderIfContent',
      'writeBoldSubheaderWithWrappedText',
      'writeAtomicTableChunks',
      'writeUnderlinedSubheader',
      'addSectionSpacer',
      'addPage',
      'renderTable',
      'writeSignatureBlock',
      'writeBrevhoved',
      'addUdkastWatermark',
      'addContentWidthImage',
      'addFooter',
    ]) {
      expect(callCount(name), `${name} skal dispatches præcis én gang`).toBe(1);
    }
    expect(callCount('writeWrappedText')).toBe(3);
    expect(callCount('keepWithNext')).toBe(2);
    expect(calls.find((call) => call.name === 'writeSignatureBlock')?.args).toEqual([
      'Dato',
      'Signatur',
      'Skadelidte',
    ]);
    expect(calls.find((call) => call.name === 'writeLeftRightText')?.args[2]).toEqual({
      minRightColumnWidthText: '000',
    });
    expect(calls.find((call) => call.name === 'addContentWidthImage')?.args.slice(0, 1)).toEqual([
      'data:image/png;base64,AA==',
    ]);
  });

  // NY-12c-3: en sumlinje (label/værdi med summeringsstreg) holdes sammen med den sidste
  // forudgående post, så den aldrig står alene øverst på en side.
  describe('keep-with-previous for sumlinjer', () => {
    const LINE = PDF_BASE_LINE_HEIGHT_MM + PDF_LINE_BOTTOM_SPACING_MM;
    const SPACER = PDF_BASE_LINE_HEIGHT_MM;
    const sum = { separatorAboveValue: { widthMm: 30, gapMm: 4 } } as const;

    // Reservationer (keepWithNext / keepLastLineWithNext) umiddelbart før skrivekaldet.
    const reservationsBefore = (
      calls: readonly RecordedCall[],
      name: string,
      firstArg: unknown,
    ): Readonly<Record<string, unknown>> => {
      const result: Record<string, unknown> = {};
      for (
        let index = calls.findIndex((call) => call.name === name && call.args[0] === firstArg) - 1;
        index >= 0 && (calls[index]?.name === 'keepWithNext' || calls[index]?.name === 'keepLastLineWithNext');
        index -= 1
      ) {
        const call = calls[index];
        if (call) result[call.name] = call.args[0];
      }
      return result;
    };

    it('reserverer sidste atomiske række + afstand + sumlinje før sidste række', () => {
      const { composer, build } = createDocumentComposer();
      const { writer, calls } = createRecordingTarget();
      composer.writeAtomicTableChunks({
        rows: ['Kvittering 01', 'Kvittering 02', 'Kvittering 03'],
        renderHeader: () => {
          composer.writeSectionHeader('Øvrige krav');
          return undefined;
        },
        renderRow: (row) => {
          composer.writeLeftRightText(row, '100 kr.');
          return undefined;
        },
        estimateRowHeight: 8,
        headerHeight: 16,
      });
      composer.addSectionSpacer();
      composer.writeLeftRightText('I alt', '300 kr.', sum);

      renderDocumentModel(writer, build());

      const lastRow = reservationsBefore(calls, 'writeLeftRightText', 'Kvittering 03');
      expect(lastRow.keepWithNext).toBeCloseTo(8 + SPACER + LINE);
      expect(lastRow.keepLastLineWithNext).toBeCloseTo(SPACER + LINE);
      expect(reservationsBefore(calls, 'writeLeftRightText', 'Kvittering 02')).toEqual({});
      expect(calls.find((call) => call.name === 'writeAtomicTableChunks')?.args).toEqual([8, 16]);
    });

    it('lægger reservationen i header-blokken, når der kun er én række', () => {
      const { composer, build } = createDocumentComposer();
      const { writer, calls } = createRecordingTarget();
      composer.writeAtomicTableChunks({
        rows: ['Eneste'],
        renderHeader: () => undefined,
        renderRow: (row) => {
          composer.writeLeftRightText(row, '100 kr.');
          return undefined;
        },
        estimateRowHeight: 8,
        headerHeight: 16,
      });
      composer.writeLeftRightText('I alt', '100 kr.', sum);

      renderDocumentModel(writer, build());

      const [, headerHeight] = calls.find((call) => call.name === 'writeAtomicTableChunks')?.args ?? [];
      expect(headerHeight).toBeCloseTo(16 + LINE);
      expect(reservationsBefore(calls, 'writeLeftRightText', 'Eneste')).toEqual({ keepLastLineWithNext: LINE });
    });

    it('holder en almindelig linje sammen med hele kæden af sumlinjer', () => {
      const { composer, build } = createDocumentComposer();
      const { writer, calls } = createRecordingTarget();
      composer.writeLeftRightText('Post', '100 kr.');
      composer.writeLeftRightText('Subtotal', '100 kr.', sum);
      composer.addSectionSpacer();
      composer.writeLeftRightText('I alt', '100 kr.', sum);

      renderDocumentModel(writer, build());

      const post = reservationsBefore(calls, 'writeLeftRightText', 'Post');
      expect(post.keepLastLineWithNext).toBeCloseTo(LINE + SPACER + LINE);
    });

    it('lægger reservationen på sidste linje af en flerlinjet brødtekst foran en sumlinje', () => {
      const { composer, build } = createDocumentComposer();
      const { writer, calls } = createRecordingTarget();
      composer.writeWrappedText('Et langt afsnit, der ombrydes over flere linjer.');
      composer.addSectionSpacer();
      composer.writeLeftRightText('I alt', '100 kr.', sum);

      renderDocumentModel(writer, build());

      const text = reservationsBefore(calls, 'writeWrappedText', 'Et langt afsnit, der ombrydes over flere linjer.');
      expect(text).toEqual({ keepLastLineWithNext: SPACER + LINE });
    });

    it('reserverer intet, når der ikke følger en sumlinje', () => {
      const { composer, build } = createDocumentComposer();
      const { writer, calls } = createRecordingTarget();
      composer.writeLeftRightText('Post', '100 kr.');
      composer.addSectionSpacer();
      composer.writeLeftRightText('Ikke-sum', '100 kr.');

      renderDocumentModel(writer, build());

      expect(calls.some((call) => call.name === 'keepWithNext' || call.name === 'keepLastLineWithNext')).toBe(false);
    });
  });
});
