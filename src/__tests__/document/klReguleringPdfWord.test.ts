// @vitest-environment jsdom
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { toISODateString as iso } from '../../types/branded';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { generateErstatningsopgoerelseDocument } from '../../document/generators/eo/erstatningsopgoerelseDocument';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';

// C1: håndregnede facitter med øreafrunding efter hvert trin, aldrig præsentationens egen genberegning.
describe('klReguleringPdfWord', () => {
  it.each([
    { basis: '2024-04-01', fra: '2025-10-01', retning: 'Fremad', tal: ['30.000,00', '30.390,00', '30.481,17'], baglaens: false },
    { basis: '2025-10-01', fra: '2024-04-01', retning: 'Baglæns', tal: ['30.000,00', '29.910,27', '29.526,43'], baglaens: true },
  ])('viser alle anvendte KL-trin ved $retning i begge artefakter', async ({ basis, fra, retning, tal, baglaens }) => {
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2022-01-01') };
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.kravPaaOevrigeErstatningskrav = 'Nej';
    values.vedroererPeriodeFra = iso(fra);
    values.vedroererPeriodeTil = iso(fra.slice(0, 7) + '-30');
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = { kind: 'number', value: 30000 };
    values.angivetMaanedsloenBaseretPaa = 'Samlet løn på reguleringsdatoen';
    values.angivetMaanedsloenOpreguleresFraDato = iso(basis);
    values.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'KL-lønaftaler';
    values.tafPerioder = [{ id: 'taf', fra: values.vedroererPeriodeFra, til: values.vedroererPeriodeTil, loseFeriedage: undefined }];
    const projection = eoSnapshotToEoDocument(computeEoSnapshot({ revision: 'kl-visning', stamdataValues: stamdata, eoValues: values }));
    if (projection.kind === 'blocked') throw new Error(projection.message);
    const run = (session: DocumentGenerationSession) => generateErstatningsopgoerelseDocument(session, stamdata, values, {
      opgoerelse: true, loenindkomst: false, offentligeYdelser: false, shDage: false,
      regulering: true, okSatser: false, sygeferiegodtgoerelse: false, midlertidigEet: false,
    }, { visBrevhoved: false, visUdkastStempel: false, document: projection.document });
    const pdf = await run(await createRealPdfDocumentSessionForTest());
    const word = await renderWordDocument(run);
    for (const text of [await extractPdfText(pdf.blob), xmlToPlainText(word.documentXml)]) {
      for (const value of ['Løn før', 'Løn efter', '01-10-2024', '01-10-2025', retning, ...tal]) expect(text).toContain(value);
      if (baglaens) expect(text).toContain('beregnes lønnen baglæns');
    }
  });
});
