import { createDocumentComposer } from '../../../document/model/documentModel';

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
        renderContent: () => composer.writeWrappedText('Må ikke bygges'),
      }),
    ).toBe(false);
    expect(
      composer.writeBoldSubheaderIfContent({
        text: 'Indhold',
        hasContent: true,
        renderContent: () => composer.writeWrappedText('En linje'),
      }),
    ).toBe(true);

    expect(build().blocks).toEqual([
      {
        kind: 'conditionalSubsection',
        text: 'Indhold',
        nextLineHeight: undefined,
        addTopSpacing: undefined,
        blocks: [{ kind: 'wrappedText', text: 'En linje' }],
      },
    ]);
  });

  it('materialiserer atomiske rækker som data før rendering', () => {
    const { composer, build } = createDocumentComposer();

    composer.writeAtomicTableChunks({
      rows: ['A', 'B'],
      renderHeader: () => composer.writeBoldSubheader('Header'),
      renderRow: (row) => composer.writeWrappedText(row),
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
            nextLineHeight: undefined,
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
});
