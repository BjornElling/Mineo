// @vitest-environment jsdom
import { writeRenteOversigtDocumentContent, type RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import { toISODateString } from '../../../types/branded';

const makeRow = (overrides?: Partial<RenteOversigtRow>): RenteOversigtRow => ({
  beloeb: 1250,
  renterFra: toISODateString('2024-01-11'),
  beregnetRente: 2.25,
  ...overrides,
});

describe('writeRenteOversigtDocumentContent', () => {
  it('kaster når der ingen rækker er', () => {
    const writer = createPdfChannelWriter();
    expect(() => {
      writeRenteOversigtDocumentContent(writer, toISODateString('2024-02-01'), []);
    }).toThrow('Ingen renteberegninger fundet for oversigt');
  });

  it('skriver indhold uden undtagelse for gyldige rækker', () => {
    const writer = createPdfChannelWriter();
    expect(() => {
      writeRenteOversigtDocumentContent(writer, toISODateString('2024-02-01'), [
        makeRow(),
        makeRow({ beloeb: 5000, renterFra: toISODateString('2023-06-01'), beregnetRente: 412.5 }),
      ]);
    }).not.toThrow();
  });

  it('skriver indhold med kommentarer og brevhoved uden undtagelse', () => {
    const writer = createPdfChannelWriter();
    expect(() => {
      writeRenteOversigtDocumentContent(writer, toISODateString('2024-02-01'), [makeRow()], {
        visBrevhoved: true,
        stamdata: { journalnr: '12345', advokat: 'Adv. Test', sagsbehandler: 'Sb. Test' },
        kommentarer: 'En kommentar til oversigten',
      });
    }).not.toThrow();
  });

  it('skriver hypotetisk-advarsel med samme tekst som rente-specifikationen', () => {
    const writer = createPdfChannelWriter();
    const warningSpy = vi.spyOn(writer, 'writeBoldWrappedText');

    writeRenteOversigtDocumentContent(writer, toISODateString('2024-02-01'), [makeRow()], {
      latestReferenceRateDate: toISODateString('2024-01-31'),
    });

    expect(warningSpy).toHaveBeenCalledWith(
      'Der er kun fastsat procesrente frem til 31-01-2024. Beregning derefter er hypotetisk!'
    );
  });

  it('udelader hypotetisk-advarsel når beregningsdatoen er dækket af procesrentesatser', () => {
    const writer = createPdfChannelWriter();
    const warningSpy = vi.spyOn(writer, 'writeBoldWrappedText');

    writeRenteOversigtDocumentContent(writer, toISODateString('2024-01-31'), [makeRow()], {
      latestReferenceRateDate: toISODateString('2024-01-31'),
    });

    expect(warningSpy).not.toHaveBeenCalled();
  });

  it('kalder ikke addFooter eller save — det er kalderens ansvar', () => {
    const writer = createPdfChannelWriter();
    const saveSpy = vi.spyOn(writer, 'save');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRenteOversigtDocumentContent(writer, toISODateString('2024-02-01'), [makeRow()]);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});
