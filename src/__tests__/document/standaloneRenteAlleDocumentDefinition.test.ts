import type {
  DocumentGenerationSession,
  DocumentRenderRequest,
} from '../../document/documentGenerationSession';
import type { DocumentBlock } from '../../document/model/documentModel';
import {
  standaloneRenteAlleDocumentDefinition,
  type StandaloneRenteAlleDocumentInput,
} from '../../apps/minprocesrente/document/standaloneRenteDocumentDefinitions';
import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import { createDate } from '../../utils/dateUtils';
import { toISODateString } from '../../types/branded';

const makePeriod = (
  amount: number,
  startDate: Date,
  endDate: Date,
  days: number,
  interest: number,
): ProcessInterestPeriod => ({
  startDate,
  endDate,
  amount,
  referenceRatePct: 3.35,
  surchargeRatePct: 8,
  totalRatePct: 11.35,
  days,
  interest,
});

const createFixtureSession = (): Readonly<{
  session: DocumentGenerationSession;
  requests: DocumentRenderRequest[];
}> => {
  const requests: DocumentRenderRequest[] = [];
  const session: DocumentGenerationSession = Object.freeze({
    format: 'pdf',
    render: async (request): Promise<Blob> => {
      requests.push(request);
      return new Blob();
    },
  });

  return { session, requests };
};

const blockText = (block: DocumentBlock): string => {
  switch (block.kind) {
    case 'wrappedText':
      return block.text;
    case 'normalThenBoldLine':
      return `${block.normalPart}${block.boldPart}`;
    case 'labelValue':
      return `${block.label}${block.value}`;
    case 'sectionHeader':
    case 'title':
    case 'boldSubheader':
    case 'underlinedSubheader':
      return block.text;
    case 'boldSubheaderWithText':
      return `${block.subheaderText}${block.bodyText}`;
    default:
      return '';
  }
};

describe('standalone-rente-alle dokumentdefinition', () => {
  it('komponerer alle rækker som én semantisk model med sideadskillelse og filnavn', async () => {
    const input: StandaloneRenteAlleDocumentInput = {
      rows: [
        {
          beloeb: 1000,
          actualInterestDate: toISODateString('2024-01-01'),
          beregningsdato: toISODateString('2024-01-31'),
          periods: [makePeriod(
            1000,
            createDate(2024, 0, 1),
            createDate(2024, 0, 31),
            31,
            9.62,
          )],
          latestReferenceRatePeriodEnd: toISODateString('2024-06-30'),
        },
        {
          beloeb: 2000,
          actualInterestDate: toISODateString('2024-02-01'),
          beregningsdato: toISODateString('2024-02-29'),
          periods: [makePeriod(
            2000,
            createDate(2024, 1, 1),
            createDate(2024, 1, 29),
            29,
            17.96,
          )],
          latestReferenceRatePeriodEnd: toISODateString('2024-06-30'),
        },
      ],
      kommentarer: undefined,
    };
    const { session, requests } = createFixtureSession();
    const render = await standaloneRenteAlleDocumentDefinition.loadRenderer();

    const artifact = await render(session, input, { visBrevhoved: false });

    expect(requests).toHaveLength(1);
    const model = requests[0]?.model;
    expect(model).toBeDefined();
    if (model === undefined) throw new Error('Dokumentmodellen mangler');

    const titles = model.blocks.filter((block) => block.kind === 'title');
    const tables = model.blocks.filter((block) => block.kind === 'table');
    const pageBreaks = model.blocks.filter((block) => block.kind === 'pageBreak');
    const footers = model.blocks.filter((block) => block.kind === 'footer');

    expect(titles).toHaveLength(2);
    expect(titles.every((block) => block.kind === 'title' && block.text === 'Procesrente')).toBe(true);
    expect(tables).toHaveLength(2);
    expect(pageBreaks).toHaveLength(1);
    expect(footers).toHaveLength(1);
    expect(model.blocks.at(-1)?.kind).toBe('footer');

    const pageBreakIndex = model.blocks.findIndex((block) => block.kind === 'pageBreak');
    const firstTableIndex = model.blocks.findIndex((block) => block.kind === 'table');
    const secondTableIndex = model.blocks.findIndex(
      (block, index) => block.kind === 'table' && index > firstTableIndex,
    );
    expect(firstTableIndex).toBeLessThan(pageBreakIndex);
    expect(pageBreakIndex).toBeLessThan(secondTableIndex);

    const texts = model.blocks.map(blockText);
    expect(texts).toEqual(expect.arrayContaining([
      'Hovedstol: 1.000,00 kr.',
      'Hovedstol: 2.000,00 kr.',
      'Periode: 01-01-2024 - 31-01-2024 (begge dage inkl.)',
      'Periode: 01-02-2024 - 29-02-2024 (begge dage inkl.)',
    ]));
    expect(artifact.filename).toBe(
      'Procesrente, 1.000,00 kr. (01-01-2024 - 31-01-2024) +1.pdf',
    );
  });
});
