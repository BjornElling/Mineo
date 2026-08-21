/**
 * Forsørgertab-dokumentdefinitionen.
 *
 * Genbruger `buildForsoergertabReaderProjection` + `evaluateForsoergertabDownloadGate` uændret
 * (§5.4). Stamdata-projektionen er en dependency i `project`, så samme blokering styrer både
 * knappens tilstand og click-preflighten.
 */
import type { StamdataValues } from '../../schemas/formSchemas';
import { defineMineoDocument, type MineoDocumentDefinition } from '../../document/definition/mineoDocumentDefinition';
import { blockedProjectionForStamdata, toGateReasons } from '../../document/definition/documentOutcome';
import { projectStamdataForDocumentIfEnabled } from '../stamdata/stamdataDocumentProjection';
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

      // Se noten i `varigeMenDocumentDefinition`: brevhoved-stamdata kan kun blokere på en RØD feltfejl
      // (kun `optional`-reads), og årsagen peger direkte på den flade, hvor fejlen kan rettes.
      const stamdata = projectStamdataForDocumentIfEnabled(
        context.evaluation.reader,
        FORSOERGERTAB_DOCUMENT_CONSUMER_ID,
        context.settings.brevhovedIndstillinger.forsoergertab
      );
      if (stamdata.status !== 'ready') {
        return blockedProjectionForStamdata('forsoergertab:stamdata-blocked');
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
