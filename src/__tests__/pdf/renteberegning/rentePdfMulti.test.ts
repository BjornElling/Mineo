// @vitest-environment jsdom
import { writeRenteDocumentContent, generateRenteDocument } from '../../../document/generators/renteberegning/renteDocument';
import { createPdfChannelWriter } from '../../../pdf/infrastructure/pdfWriter';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import { toISODateString, type ISODateString } from '../../../types/branded';
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
  it('summerer de viste periodebeløb i totalrækken', () => {
    const { composer, build } = createDocumentComposer();
    const periods = [
      makePeriod({ interest: 1192.624 }),
      makePeriod({ interest: 1282.874 }),
    ];

    writeRenteDocumentContent(
      composer,
      108895.03,
      new Date(toISODateString('2026-05-21')),
      new Date(toISODateString('2026-08-12')),
      periods,
      {},
    );

    const table = build().blocks.find((block) => block.kind === 'table');
    expect(table?.kind).toBe('table');
    if (table?.kind !== 'table') throw new Error('Rentetabellen mangler');

    const totalRow = table.spec.rows.at(-1);
    expect(totalRow?.cells.at(-1)?.text).toBe('2.475,49\u00A0kr.');
  });

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

  it('kalder ikke addFooter – det er kalderens ansvar', () => {
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
      generateRenteDocument(pdfSession, 1000, toISODateString('2024-01-01'), toISODateString('2024-01-31'), []);
    }).toThrow('Ingen perioder fundet for renteberegning');
  });

  // Castet er BEVIDST: parameteren er `ISODateString`, så en ugyldig dato ikke KAN nå hertil ad
  // en typet vej. Testen beviser, at generatorens defensive parse-guard stadig fyrer – den er defense-in-depth
  // mod en `as`-omgåelse eller en fremtidig utypet kalder, og en fjernet guard skal gøre noget rødt.
  it('kaster ved ugyldige datoer', () => {
    expect(() => {
      generateRenteDocument(pdfSession, 1000, 'ikke-en-dato' as ISODateString, toISODateString('2024-01-31'), [makePeriod()]);
    }).toThrow('Ugyldige datoer for renteberegning');
  });
});
