// @vitest-environment jsdom
import { writeRenteOversigtDocumentContent, type RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import { toISODateString } from '../../../types/branded';
import { createDocumentComposer, renderDocumentModel } from '../../../document/model/documentModel';

const makeRow = (overrides?: Partial<RenteOversigtRow>): RenteOversigtRow => ({
  beloeb: 1250,
  rentedato: toISODateString('2024-01-11'),
  beregnetRente: 2.25,
  ...overrides,
});

describe('writeRenteOversigtDocumentContent', () => {
  it('kaster når der ingen rækker er', () => {
    const { composer } = createDocumentComposer();
    expect(() => {
      writeRenteOversigtDocumentContent(composer, toISODateString('2024-02-01'), []);
    }).toThrow('Ingen renteberegninger fundet for oversigt');
  });

  it('skriver indhold uden undtagelse for gyldige rækker', () => {
    const writer = createPdfChannelWriter();
    const { composer, build } = createDocumentComposer();
    expect(() => {
      writeRenteOversigtDocumentContent(composer, toISODateString('2024-02-01'), [
        makeRow(),
        makeRow({ beloeb: 5000, rentedato: toISODateString('2023-06-01'), beregnetRente: 412.5 }),
      ]);
      renderDocumentModel(writer, build());
    }).not.toThrow();
  });

  it('skriver indhold med kommentarer og brevhoved uden undtagelse', () => {
    const writer = createPdfChannelWriter();
    const { composer, build } = createDocumentComposer();
    expect(() => {
      writeRenteOversigtDocumentContent(composer, toISODateString('2024-02-01'), [makeRow()], {
        visBrevhoved: true,
        stamdata: { journalnr: '12345', advokat: 'Adv. Test', sagsbehandler: 'Sb. Test' },
        kommentarer: 'En kommentar til oversigten',
      });
      renderDocumentModel(writer, build());
    }).not.toThrow();
  });

  it('skriver hypotetisk-advarsel med samme tekst som rente-specifikationen', () => {
    const { composer, build } = createDocumentComposer();

    writeRenteOversigtDocumentContent(composer, toISODateString('2024-07-01'), [makeRow()], {
      latestReferenceRatePeriodEnd: toISODateString('2024-06-30'),
    });

    expect(build().blocks).toContainEqual(expect.objectContaining({ text: expect.stringContaining('Beregning derefter er hypotetisk!') }));
  });

  it('udelader hypotetisk-advarsel når beregningsdatoen er dækket af procesrentesatser', () => {
    const { composer, build } = createDocumentComposer();

    writeRenteOversigtDocumentContent(composer, toISODateString('2024-06-30'), [makeRow()], {
      latestReferenceRatePeriodEnd: toISODateString('2024-06-30'),
    });

    expect(build().blocks).not.toContainEqual(expect.objectContaining({ text: expect.stringContaining('Beregning derefter er hypotetisk!') }));
  });

  it('kalder ikke addFooter eller save – det er kalderens ansvar', () => {
    const writer = createPdfChannelWriter();
    const { composer, build } = createDocumentComposer();
    const saveSpy = vi.spyOn(writer, 'build');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRenteOversigtDocumentContent(composer, toISODateString('2024-02-01'), [makeRow()]);
    renderDocumentModel(writer, build());

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});
