import { createDocumentComposer, renderDocumentModel } from '../../../document/model/documentModel';
import type { DocumentWriter } from '../../../document/writer';
import { getToday } from '../../../config/dateRanges';

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
});
