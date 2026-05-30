import { writeRenteOversigtPdfContent, buildRenteOversigtPdfFilename, type RenteOversigtRow } from '../../../pdf/domains/renteberegning/renteOversigtPdf';
import { createStandardPdfWriter } from '../../../pdf/infrastructure/pdfWriter';
import { toISODateString } from '../../../types/branded';

const makeRow = (overrides?: Partial<RenteOversigtRow>): RenteOversigtRow => ({
  beloeb: 1250,
  renterFra: toISODateString('2024-01-11'),
  beregnetRente: 2.25,
  ...overrides,
});

describe('writeRenteOversigtPdfContent', () => {
  it('kaster når der ingen rækker er', () => {
    const writer = createStandardPdfWriter();
    expect(() => {
      writeRenteOversigtPdfContent(writer, toISODateString('2024-02-01'), []);
    }).toThrow('Ingen renteberegninger fundet for oversigt');
  });

  it('skriver indhold uden undtagelse for gyldige rækker', () => {
    const writer = createStandardPdfWriter();
    expect(() => {
      writeRenteOversigtPdfContent(writer, toISODateString('2024-02-01'), [
        makeRow(),
        makeRow({ beloeb: 5000, renterFra: toISODateString('2023-06-01'), beregnetRente: 412.5 }),
      ]);
    }).not.toThrow();
  });

  it('skriver indhold med kommentarer og brevhoved uden undtagelse', () => {
    const writer = createStandardPdfWriter();
    expect(() => {
      writeRenteOversigtPdfContent(writer, toISODateString('2024-02-01'), [makeRow()], {
        visBrevhoved: true,
        stamdata: { journalnr: '12345', advokat: 'Adv. Test', sagsbehandler: 'Sb. Test' },
        kommentarer: 'En kommentar til oversigten',
      });
    }).not.toThrow();
  });

  it('kalder ikke addFooter eller save — det er kalderens ansvar', () => {
    const writer = createStandardPdfWriter();
    const saveSpy = vi.spyOn(writer, 'save');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRenteOversigtPdfContent(writer, toISODateString('2024-02-01'), [makeRow()]);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});

describe('buildRenteOversigtPdfFilename', () => {
  it('indeholder titlen', () => {
    expect(buildRenteOversigtPdfFilename()).toContain('Procesrente');
  });
});
