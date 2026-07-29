/**
 * Forsørgertab-dokumentdefinitionen (Fase 5; `document-output-contract.md` §A1.2/§A7.1).
 *
 * Genbruger `buildForsoergertabReaderProjection` + `evaluateForsoergertabDownloadGate` uændret
 * (§5.4). Stamdata-projektionen er en dependency på outputtet, ikke en separat click-betingelse:
 * før Fase 5 stod `freshStamdata.status !== 'ready'` som en stille `return` i click-handleren,
 * hvor den reaktive gate slet ikke kendte den. Nu er den en del af `project`, så knappen også
 * er disabled, når stamdata blokerer.
 */
import type { StamdataValues } from '../../schemas/formSchemas';
import { defineMineoDocument, type MineoDocumentDefinition } from '../../document/definition/mineoDocumentDefinition';
import { blockedProjection, toGateReasons } from '../../document/definition/documentOutcome';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import { evaluateForsoergertabDownloadGate } from './forsoergertabDownloadGate';
import { buildForsoergertabReaderProjection } from './forsoergertabReaderProjection';
import type { ForsoergertabPdfProjection } from './forsoergertabSnapshot';

export const FORSOERGERTAB_DOCUMENT_CONSUMER_ID = 'document.forsoergertab';

export type ForsoergertabDocumentInput = Readonly<{
  pdfProjection: ForsoergertabPdfProjection;
  stamdata: StamdataValues;
}>;

export const forsoergertabDocumentDefinition: MineoDocumentDefinition<ForsoergertabDocumentInput> =
  defineMineoDocument({
    id: 'forsoergertab',
    brevhoved: { kind: 'settings-key', key: 'forsoergertab' },
    labels: { documentName: 'forsørgertab' },
    project: (context) => {
      const projection = buildForsoergertabReaderProjection(context.evaluation.reader);
      const gate = evaluateForsoergertabDownloadGate(projection);
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'forsoergertab:blocked',
            message: 'Dokumentet kan ikke hentes for den aktuelle sag',
          }),
        };
      }

      const stamdata = projectStamdataForDocument(context.evaluation.reader, FORSOERGERTAB_DOCUMENT_CONSUMER_ID);
      if (stamdata.status !== 'ready') {
        return blockedProjection('forsoergertab:stamdata-blocked', 'Fejl i indtastning');
      }

      return {
        status: 'ready',
        input: { pdfProjection: projection.snapshot.pdfProjection, stamdata: stamdata.value },
      };
    },
    loadRenderer: async () => {
      const { generateForsoergertabDocument } = await import(
        '../../document/generators/forsoergertab/forsoergertabDocument'
      );
      return (session, input, ctx) => generateForsoergertabDocument(session, {
        ...input.pdfProjection,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });
