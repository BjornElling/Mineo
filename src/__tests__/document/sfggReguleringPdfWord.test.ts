// @vitest-environment jsdom
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../types/branded';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { generateErstatningsopgoerelseDocument } from '../../document/generators/eo/erstatningsopgoerelseDocument';
import type { DocumentGenerationSession } from '../../document/documentGenerationSession';
import { createRealPdfDocumentSessionForTest } from '../utils/pdf/createPdfDocumentSession';
import { extractPdfText } from '../utils/pdf/pdfTextExtractor';
import { renderWordDocument, xmlToPlainText } from '../docx/generators/wordContentHarness';
import { asSfggAmount, createSfggEmployment, createSfggIngenRow } from '../utils/sfggTestSupport';

const iso = toISODateString;

describe('SFGG-regulering i PDF og Word', () => {
  it.each(['Statistik', 'KL-lønaftaler'] as const)('viser den faktiske satsberegning ved %s i begge dokumenter', async (form) => {
    const tafDato = iso(form === 'Statistik' ? '2023-02-01' : '2024-02-01');
    const stamdata = { ...STAMDATA_INITIAL_VALUES, skadedato: iso('2022-02-01') };
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaTabtArbejdsfortjeneste = 'Ja';
    values.eoNummer = '2';
    values.vedroererPeriodeFra = tafDato;
    values.vedroererPeriodeTil = tafDato;
    values.beregnesUdFra = 'Angivet månedsløn';
    values.maanedsloenenUdgoer = asSfggAmount(40_000);
    values.angivetMaanedsloenBaseretPaa = 'Løn pr. 1. januar 2025';
    values.angivetMaanedsloenOpreguleresFraDato = iso('2025-01-01');
    values.eoAngivetLoenLoenudvikling = {
      ...values.eoAngivetLoenLoenudvikling,
      loenudviklingBeregningsgrundlag: form, loenudviklingStatistikModel: 'SBLON2 (Danmarks Statistik)',
    };
    values.tafPerioder = [{ id: 'taf', fra: tafDato, til: tafDato, loseFeriedage: 0 }];
    values.loenindkomstAnsaettelsesforhold = [createSfggEmployment({
      feriePct: 12.5, loenudviklingBeregningsgrundlag: 'Ingen',
      indtaegtsoplysningerTableData: [{
        id: 'ref', col0_maaned: '1', col1_maaned: '2022', col0_uge: '', col1_uge: '',
        col0_dag: undefined, col1_dag: undefined, col2: asSfggAmount(62_000),
        col3: undefined, col4: undefined, col5: undefined,
      }],
    })];
    values.sfggAnsaettelsesforhold = [{
      ...createSfggIngenRow('af-1'), sfggBeregningskilde: 'Ferieloven',
      sfggReferenceperiodeFra: iso('2022-01-01'), sfggReferenceperiodeTil: iso('2022-01-31'),
    }];
    const snapshot = computeEoSnapshot({ revision: 'sfgg-regulering-dokument', stamdataValues: stamdata, eoValues: values });
    const projection = eoSnapshotToEoDocument(snapshot);
    if (projection.kind === 'blocked') throw new Error(projection.message);
    const run = (session: DocumentGenerationSession) => generateErstatningsopgoerelseDocument(session, stamdata, values, {
      opgoerelse: true, loenindkomst: false, offentligeYdelser: false, shDage: false,
      regulering: false, okSatser: false, sygeferiegodtgoerelse: true, midlertidigEet: false,
    }, { visBrevhoved: false, visUdkastStempel: false, document: projection.document });
    const pdf = await run(await createRealPdfDocumentSessionForTest());
    const word = await renderWordDocument(run);
    for (const text of [await extractPdfText(pdf.blob), xmlToPlainText(word.documentXml)]) {
      const normalized = text.replace(/\s+/g, ' ');
      if (form === 'Statistik') {
        expect(normalized).toContain('250,00 x 115,7 / 111,9 = 258,49 kr.');
      } else {
        expect(normalized).toContain('01-10-2022: 250,00 x (100 % + 2,55 %) = 256,38 kr.');
        expect(normalized).toContain('01-04-2023: 256,38 x (100 % + 0,30 %) = 257,15 kr.');
        expect(normalized).toContain('01-10-2023: 257,15 x (100 % + 1,25 %) = 260,36 kr.');
      }
      expect(text).toContain('referenceperiodens slutdato');
    }
  });
});
