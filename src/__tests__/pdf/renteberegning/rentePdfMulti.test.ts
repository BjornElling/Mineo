import { writeRenteDocumentContent, generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString } from '../../../types/branded';

const makePeriod = (overrides?: Partial<ProcessInterestPeriod>): ProcessInterestPeriod => ({
  startDate: new Date(toISODateString('2024-01-01')),
  endDate: new Date(toISODateString('2024-06-30')),
  amount: 1000,
  referenceRatePct: 4.25,
  surchargeRatePct: 8,
  totalRatePct: 12.25,
  days: 181,
  interest: 60.87,
  ...overrides,
});

describe('writeRenteDocumentContent', () => {
  it('kan kaldes to gange på samme DocumentWriter uden undtagelse', () => {
    const writer = createPdfChannelWriter();
    const periods = [makePeriod()];
    const startDate = new Date(toISODateString('2024-01-01'));
    const endDate = new Date(toISODateString('2024-06-30'));

    expect(() => {
      writeRenteDocumentContent(writer, 1000, startDate, endDate, periods, {});
      writer.addPage();
      writeRenteDocumentContent(writer, 2000, startDate, endDate, periods, {});
    }).not.toThrow();
  });

  it('kalder ikke addFooter — det er kalderens ansvar', () => {
    const writer = createPdfChannelWriter();
    const saveSpy = vi.spyOn(writer, 'save');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRenteDocumentContent(writer, 1000, new Date(toISODateString('2024-01-01')), new Date(toISODateString('2024-06-30')), [makePeriod()], {});

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});

describe('generateRenteDocument', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRenteDocument(1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });

  it('kaster ved ugyldige datoer', () => {
    expect(() => {
      generateRenteDocument(1000, 'ikke-en-dato', '31-01-2024', [makePeriod()]);
    }).toThrow('Ugyldige datoer for renteberegning');
  });
});
