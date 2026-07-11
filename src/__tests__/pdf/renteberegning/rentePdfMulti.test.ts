// @vitest-environment jsdom
import { writeRenteDocumentContent, generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString } from '../../../types/branded';
import { createDocumentGenerationSession } from '../../../document/documentGenerationSession';
import { createDocumentComposer, renderDocumentModel } from '../../../document/model/documentModel';

const pdfSession = createDocumentGenerationSession('pdf', createPdfChannelWriter);

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
    const { composer, build } = createDocumentComposer();
    const periods = [makePeriod()];
    const startDate = new Date(toISODateString('2024-01-01'));
    const endDate = new Date(toISODateString('2024-06-30'));

    expect(() => {
      writeRenteDocumentContent(composer, 1000, startDate, endDate, periods, {});
      composer.addPage();
      writeRenteDocumentContent(composer, 2000, startDate, endDate, periods, {});
      renderDocumentModel(writer, build());
    }).not.toThrow();
  });

  it('kalder ikke addFooter — det er kalderens ansvar', () => {
    const writer = createPdfChannelWriter();
    const { composer, build } = createDocumentComposer();
    const saveSpy = vi.spyOn(writer, 'build');
    const addFooterSpy = vi.spyOn(writer, 'addFooter');

    writeRenteDocumentContent(composer, 1000, new Date(toISODateString('2024-01-01')), new Date(toISODateString('2024-06-30')), [makePeriod()], {});
    renderDocumentModel(writer, build());

    expect(saveSpy).not.toHaveBeenCalled();
    expect(addFooterSpy).not.toHaveBeenCalled();
  });
});

describe('generateRenteDocument', () => {
  it('kaster når perioder mangler', () => {
    expect(() => {
      generateRenteDocument(pdfSession, 1000, '01-01-2024', '31-01-2024', []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });

  it('kaster ved ugyldige datoer', () => {
    expect(() => {
      generateRenteDocument(pdfSession, 1000, 'ikke-en-dato', '31-01-2024', [makePeriod()]);
    }).toThrow('Ugyldige datoer for renteberegning');
  });
});
