import { writeRentePdfContent, generateRentePdf } from '../../../pdf/domains/renteberegning/rentePdf';
import { createStandardPdfWriter } from '../../../pdf/infrastructure/pdfWriter';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';

const makePeriod = (overrides?: Partial<ProcessInterestPeriod>): ProcessInterestPeriod => ({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-30'),
  amount: 1000,
  referenceRatePct: 4.25,
  surchargeRatePct: 8,
  totalRatePct: 12.25,
  days: 181,
  interest: 60.87,
  ...overrides,
});

describe('writeRentePdfContent', () => {
  it('kan kaldes to gange på samme PdfWriter uden undtagelse', () => {
    const writer = createStandardPdfWriter();
    const periods = [makePeriod()];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-06-30');

    expect(() => {
      writeRentePdfContent(writer, 1000, startDate, endDate, periods, {});
      writer.addPage();
      writeRentePdfContent(writer, 2000, startDate, endDate, periods, {});
    }).not.toThrow();
  });

  it('kalder ikke addFooter — det er kalderens ansvar', () => {
    const writer = createStandardPdfWriter();
    const saveSpy = vi.spyOn(writer, 'save');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRentePdfContent(writer, 1000, new Date('2024-01-01'), new Date('2024-06-30'), [makePeriod()], {});

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});

describe('generateRentePdf', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRentePdf(1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });

  it('kaster ved ugyldige datoer', () => {
    expect(() => {
      generateRentePdf(1000, 'ikke-en-dato', '31-01-2024', [makePeriod()]);
    }).toThrow('Ugyldige datoer for renteberegning');
  });
});
