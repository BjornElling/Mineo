import {
  defineDocument,
  initStandardDocumentWriter,
  buildStamdataBrevhovedData,
  writeLabelValueRows,
} from '../../../document/generators/documentGeneratorSetup';
import {
  createDocumentGenerationSession,
  type DocumentGenerationSession,
  type DocumentWriterFactory,
} from '../../../document/documentGenerationSession';
import { setDocumentBrand, getDocumentCreatorBrand } from '../../../document/documentBrand';
import { TODAY } from '../../../config/dateRanges';
import type { DocumentWriter } from '../../../document/writer';

/**
 * Optagende fake-writer der kun implementerer de metoder `documentGeneratorSetup` faktisk kalder
 * (`initStandardDocumentWriter` → setDisplayMode + setProperties; `writeLabelValueRows` →
 * writeLeftRightText). Vi tester dette moduls kontrakt — ikke jsPDF.
 *
 * Objekt-literalen type-tjekkes mod de RIGTIGE DocumentWriter-signaturer via `satisfies Pick<…>`, så
 * en signatur-drift i de tre kaldte metoder fanges af typecheck i stedet for at gemmes bag et bredt
 * cast. Det efterfølgende `as unknown as DocumentWriter` er afgrænset til denne ene grænse, hvor fake'n
 * leveres til kode der forventer hele writer-fladen.
 */
type RecordedWriterMethods = Pick<
  DocumentWriter,
  | 'setDisplayMode'
  | 'setProperties'
  | 'writeLeftRightText'
  | 'writeBrevhoved'
  | 'writeTitle'
  | 'addFooter'
  | 'build'
>;

type LeftRightCall = Readonly<{
  left: string;
  right: string;
  options?: Parameters<DocumentWriter['writeLeftRightText']>[2];
}>;

const createRecordingWriter = () => {
  const displayModes: Parameters<DocumentWriter['setDisplayMode']>[0][] = [];
  const properties: Parameters<DocumentWriter['setProperties']>[0][] = [];
  const leftRight: LeftRightCall[] = [];
  const lifecycle: string[] = [];
  const writer = {
    setDisplayMode: (mode) => {
      displayModes.push(mode);
    },
    setProperties: (props) => {
      properties.push(props);
    },
    writeLeftRightText: (left, right, options) => {
      leftRight.push({ left, right, options });
    },
    writeBrevhoved: () => {
      lifecycle.push('brevhoved');
    },
    writeTitle: (title) => {
      lifecycle.push(`titel:${title}`);
    },
    addFooter: () => {
      lifecycle.push('footer');
    },
    build: async () => {
      lifecycle.push('build');
      return new Blob();
    },
  } satisfies RecordedWriterMethods as unknown as DocumentWriter;
  return { writer, displayModes, properties, leftRight, lifecycle };
};

describe('documentGeneratorSetup', () => {
  let recorder: ReturnType<typeof createRecordingWriter>;
  let factoryCalls: Parameters<DocumentWriterFactory>[0][];
  let session: DocumentGenerationSession;

  beforeEach(() => {
    recorder = createRecordingWriter();
    factoryCalls = [];
    session = createDocumentGenerationSession('pdf', (params) => {
      factoryCalls.push(params);
      return recorder.writer;
    });
  });

  afterEach(() => {
    // Brand er modul-global; nulstil til standard så et brand-skift ikke lækker mellem tests.
    setDocumentBrand('mineo.dk');
  });

  describe('initStandardDocumentWriter', () => {
    it('sætter fullheight display-mode og standard-metadata med den givne titel', () => {
      initStandardDocumentWriter(session, { title: 'Ménberegning' });

      expect(recorder.displayModes).toEqual(['fullheight']);
      expect(recorder.properties).toHaveLength(1);
      expect(recorder.properties[0]).toMatchObject({
        title: 'Ménberegning',
        subject: 'Erstatningsberegning',
        author: 'mineo.dk',
      });
    });

    it('henter creator fra det aktive dokument-brand (værn mod den lukkede brand-drift)', () => {
      // Tidligere hardkodede de fleste generatorer 'mineo.dk' direkte; et brand-override
      // ville så kun slå igennem på rente-PDF'erne. Nu går creator ensartet gennem brandet.
      setDocumentBrand('MinProcesrente');
      expect(getDocumentCreatorBrand()).toBe('minprocesrente');

      initStandardDocumentWriter(session, { title: 'Renteberegning' });

      expect(recorder.properties[0]?.creator).toBe('minprocesrente');
    });

    it('bruger standard-brandet som creator uden brand-override', () => {
      initStandardDocumentWriter(session, { title: 'Årslønsberegning' });

      expect(recorder.properties[0]?.creator).toBe('mineo.dk');
    });

    it('respekterer eksplicit metadata-override uden at ændre titel', () => {
      initStandardDocumentWriter(session, {
        title: 'Procesrente',
        metadata: {
          subject: 'Renteberegning',
          author: 'minprocesrente.dk',
        },
      });

      expect(recorder.properties[0]).toMatchObject({
        title: 'Procesrente',
        subject: 'Renteberegning',
        author: 'minprocesrente.dk',
        creator: 'mineo.dk',
      });
    });

    it('videresender writer-options til fabrikken', () => {
      const onLayoutFallback = () => undefined;
      initStandardDocumentWriter(session, {
        title: 'Satser',
        options: { visUdkastStempel: true, orientation: 'landscape', onLayoutFallback },
      });

      expect(factoryCalls).toHaveLength(1);
      expect(factoryCalls[0]).toEqual({
        visUdkastStempel: true,
        orientation: 'landscape',
        onLayoutFallback,
      });
    });
  });

  describe('buildStamdataBrevhovedData', () => {
    it('mapper stamdata-felter og stempler dags dato', () => {
      const result = buildStamdataBrevhovedData({
        journalnr: 'J-42',
        advokat: 'Advokat A',
        sagsbehandler: 'Sagsbehandler S',
      });

      expect(result).toEqual({
        journalnr: 'J-42',
        advokat: 'Advokat A',
        sagsbehandler: 'Sagsbehandler S',
        dagsDatoISO: TODAY,
      });
    });

    it('giver tomme felter men stadig dags dato ved manglende stamdata', () => {
      expect(buildStamdataBrevhovedData(null)).toEqual({
        journalnr: undefined,
        advokat: undefined,
        sagsbehandler: undefined,
        dagsDatoISO: TODAY,
      });
      expect(buildStamdataBrevhovedData(undefined).dagsDatoISO).toBe(TODAY);
    });
  });

  describe('defineDocument', () => {
    it('ejer den faste rækkefølge fra brevhoved til artefakt', async () => {
      const generate = defineDocument<Readonly<{ id: string }>>({
        title: ({ id }) => `Dokument ${id}`,
        filename: ({ id }) => `${id}.pdf`,
        brevhoved: () => ({ dagsDatoISO: TODAY }),
        beforeBrevhoved: (writer) => {
          recorder.lifecycle.push('før-brevhoved');
          expect(writer).toBe(recorder.writer);
        },
        body: (writer) => {
          expect(writer).toBe(recorder.writer);
          recorder.lifecycle.push('indhold');
        },
      });

      const artifact = await generate(session, { id: '42' });

      expect(recorder.lifecycle).toEqual([
        'før-brevhoved',
        'brevhoved',
        'titel:Dokument 42',
        'indhold',
        'footer',
        'build',
      ]);
      expect(artifact.filename).toBe('42.pdf');
    });

    it('kan fravælge titel og brevhoved uden at svække footer/build-lifecyclen', async () => {
      const generate = defineDocument<string>({
        title: 'Graf',
        filename: (filename) => filename,
        writeTitle: false,
        body: () => {
          recorder.lifecycle.push('graf');
        },
      });

      const artifact = await generate(session, 'graf.pdf');

      expect(recorder.lifecycle).toEqual(['graf', 'footer', 'build']);
      expect(artifact.filename).toBe('graf.pdf');
    });

    it('bygger ikke et delvist dokument når body fejler', async () => {
      const generate = defineDocument<void>({
        title: 'Fejlende dokument',
        filename: () => 'maa-ikke-gemmes.pdf',
        body: () => {
          recorder.lifecycle.push('indhold');
          throw new Error('rendering fejlede');
        },
      });

      await expect(generate(session, undefined)).rejects.toThrow('rendering fejlede');
      expect(recorder.lifecycle).toEqual(['titel:Fejlende dokument', 'indhold']);
    });
  });

  describe('writeLabelValueRows', () => {
    it('skriver én venstre-højre-linje pr. række', () => {
      writeLabelValueRows(recorder.writer, [
        { label: 'Méngrad', value: '10 %' },
        { label: 'Beregningsdato', value: '01-01-2026' },
      ]);

      expect(recorder.leftRight).toHaveLength(2);
      expect(recorder.leftRight[0]).toMatchObject({ left: 'Méngrad', right: '10 %' });
      expect(recorder.leftRight[1]).toMatchObject({ left: 'Beregningsdato', right: '01-01-2026' });
    });

    it('defaulter rightFontStyle til normal og respekterer eksplicit bold', () => {
      writeLabelValueRows(recorder.writer, [
        { label: 'Grundbeløb', value: '100 kr.' },
        { label: 'Beregnet', value: '90 kr.', rightFontStyle: 'bold' },
      ]);

      expect(recorder.leftRight[0]?.options).toEqual({ rightFontStyle: 'normal' });
      expect(recorder.leftRight[1]?.options).toEqual({ rightFontStyle: 'bold' });
    });

    it('skriver intet ved tom rækkeliste', () => {
      writeLabelValueRows(recorder.writer, []);
      expect(recorder.leftRight).toHaveLength(0);
    });
  });
});
