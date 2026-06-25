import {
  initStandardDocumentWriter,
  buildStamdataBrevhovedData,
  writeLabelValueRows,
} from '../../../document/generators/documentGeneratorSetup';
import {
  setFallbackDocumentWriterFactory,
  type DocumentWriterFactory,
} from '../../../document/documentGenerationContext';
import { setDocumentBrand, getDocumentCreatorBrand } from '../../../document/documentBrand';
import { TODAY } from '../../../config/dateRanges';
import type { DocumentWriter } from '../../../document/writer';

/**
 * Optagende fake-writer der kun implementerer de metoder `documentGeneratorSetup`
 * faktisk kalder. Castet er beviseligt sikkert: `initStandardDocumentWriter` kalder
 * udelukkende `setDisplayMode` + `setProperties`, og `writeLabelValueRows` kalder
 * udelukkende `writeLeftRightText`. Vi tester dette moduls kontrakt — ikke jsPDF.
 */
type LeftRightCall = Readonly<{
  left: string;
  right: string;
  options?: Parameters<DocumentWriter['writeLeftRightText']>[2];
}>;

const createRecordingWriter = () => {
  const displayModes: string[] = [];
  const properties: Parameters<DocumentWriter['setProperties']>[0][] = [];
  const leftRight: LeftRightCall[] = [];
  const writer = {
    setDisplayMode: (mode: string) => {
      displayModes.push(mode);
    },
    setProperties: (props: Parameters<DocumentWriter['setProperties']>[0]) => {
      properties.push(props);
    },
    writeLeftRightText: (
      left: string,
      right: string,
      options?: Parameters<DocumentWriter['writeLeftRightText']>[2],
    ) => {
      leftRight.push({ left, right, options });
    },
  } as unknown as DocumentWriter;
  return { writer, displayModes, properties, leftRight };
};

describe('documentGeneratorSetup', () => {
  let recorder: ReturnType<typeof createRecordingWriter>;
  let factoryCalls: Parameters<DocumentWriterFactory>[0][];

  beforeEach(() => {
    recorder = createRecordingWriter();
    factoryCalls = [];
    setFallbackDocumentWriterFactory((params) => {
      factoryCalls.push(params);
      return recorder.writer;
    });
  });

  afterEach(() => {
    setFallbackDocumentWriterFactory(null);
    // Brand er modul-global; nulstil til standard så et brand-skift ikke lækker mellem tests.
    setDocumentBrand('mineo.dk');
  });

  describe('initStandardDocumentWriter', () => {
    it('sætter fullheight display-mode og standard-metadata med den givne titel', () => {
      initStandardDocumentWriter({ title: 'Ménberegning' });

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

      initStandardDocumentWriter({ title: 'Renteberegning' });

      expect(recorder.properties[0]?.creator).toBe('minprocesrente');
    });

    it('bruger standard-brandet som creator uden brand-override', () => {
      initStandardDocumentWriter({ title: 'Årslønsberegning' });

      expect(recorder.properties[0]?.creator).toBe('mineo.dk');
    });

    it('respekterer eksplicit metadata-override uden at ændre titel', () => {
      initStandardDocumentWriter({
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
      initStandardDocumentWriter({
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
