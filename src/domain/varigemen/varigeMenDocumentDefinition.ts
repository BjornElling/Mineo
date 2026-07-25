/**
 * Varige mén-dokumentdefinitionen (Fase 5; `document-output-contract.md` §A1.2/§A7.1).
 *
 * Genbruger `buildVarigeMenReaderProjection` + `evaluateVarigeMenDownloadGate` uændret (§5.4).
 * Stamdata-projektionen bliver — som for Forsørgertab — en dependency på outputtet frem for en
 * stille `return` i click-handleren.
 *
 * Sidens shake- og fokus-feedback ved en blokeret aktivering er ren præsentation og bliver
 * bevidst IKKE en del af definitionen: siden reagerer på `download()`s `rejected`-udfald. Gaten
 * afgør HVAD der er blokeret; siden afgør hvordan det vises.
 */
import type { StamdataValues } from '../../schemas/formSchemas';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import {
  defineDocumentOutput,
  type DocumentDefinition,
} from '../../document/definition/documentDefinition';
import { resolveStamdataDatoLabel } from '../policies/stamdataCalculations';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import type { VarigeMenBeregningResult } from './varigeMenCalculations';
import { evaluateVarigeMenDownloadGate } from './varigeMenDownloadGate';
import { buildVarigeMenReaderProjection } from './varigeMenReaderProjection';

export const VARIGEMEN_DOCUMENT_CONSUMER_ID = 'document.varigemen';

export type VarigeMenDocumentInput = Readonly<{
  fodselsdato: ISODateString | undefined;
  skadedato: ISODateString | undefined;
  mengrad: number;
  beregningsdato: ISODateString | undefined;
  beregningsResultat: VarigeMenBeregningResult;
  stamdata: StamdataValues;
}>;

export const varigeMenDocumentDefinition: DocumentDefinition<VarigeMenDocumentInput> =
  defineDocumentOutput({
    id: 'varigemen',
    brevhovedType: 'varigeMen',
    errorLabel: 'Kunne ikke generere ménberegning-PDF',
    project: (context) => {
      const projection = buildVarigeMenReaderProjection(context.evaluation.reader);
      const gate = evaluateVarigeMenDownloadGate(projection);
      if (!gate.canDownload) {
        return { status: 'blocked', reasons: gate.reasons };
      }

      // Gaten dækker allerede begge betingelser (`no-result` ved manglende resultat); gentagelsen
      // er typeindsnævring og fail-closed sikkerhedsnet, ikke en selvstændig gate.
      const beregningsResultat = projection.status === 'ready' ? projection.value.beregningsResultat : null;
      if (projection.status !== 'ready' || beregningsResultat === null) {
        return {
          status: 'blocked',
          reasons: [{ code: 'varigemen:no-result', message: 'Beregning kan ikke dannes' }],
        };
      }

      const stamdata = projectStamdataForDocument(context.evaluation.reader, VARIGEMEN_DOCUMENT_CONSUMER_ID);
      if (stamdata.status !== 'ready') {
        return {
          status: 'blocked',
          reasons: [{ code: 'varigemen:stamdata-blocked', message: 'Fejl i indtastning' }],
        };
      }

      const data = projection.value;
      return {
        status: 'ready',
        input: {
          fodselsdato: coerceToISODateString(data.fodselsdato),
          skadedato: coerceToISODateString(data.skadedato),
          mengrad: data.mengrad,
          beregningsdato: coerceToISODateString(data.beregningsdato),
          beregningsResultat,
          stamdata: stamdata.value,
        },
      };
    },
    loadRenderer: async () => {
      const { generateVarigeMenDocument } = await import(
        '../../document/generators/varigemen/varigeMenDocument'
      );
      return (session, input, ctx) => generateVarigeMenDocument(session, {
        fodselsdato: input.fodselsdato,
        skadedato: input.skadedato,
        mengrad: input.mengrad,
        beregningsdato: input.beregningsdato,
        beregningsResultat: input.beregningsResultat,
        skadedatoLabel: resolveStamdataDatoLabel(input.stamdata),
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });
