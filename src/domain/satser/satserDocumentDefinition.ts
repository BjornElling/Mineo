/**
 * Satser-dokumentdefinitionen.
 *
 * Genbruger `projectSatser` uændret (§5.4): "vist = beregnet" gælder fortsat, så et out-of-bounds
 * eller tomt satsår giver `blocked` – satserne skjules på siden, OG downloaden blokeres, fra samme
 * projektion.
 *
 * Barrierens token skal være identisk med det optagne snapshots token. Ellers kan et årsskift mellem
 * settle og kildeoptagelse danne satser for en forældet revision.
 *
 * Bemærk at satsåret IKKE er en `TRequest`: det er en almindelig, committed indtastning og læses
 * derfor af `project` fra det friske snapshot. Der er kun ét satser-output pr. sag.
 */
import { defineMineoDocument, type MineoDocumentDefinition } from '../../document/definition/mineoDocumentDefinition';
import {
  blockedProjectionFromCauses,
} from '../../document/definition/documentOutcome';
import type { StamdataValues } from '../../schemas/formSchemas';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import { projectSatser, type SatserProjectionValue } from './satserProjection';

export const SATSER_DOCUMENT_CONSUMER_ID = 'document.satser';

export type SatserDocumentInput = Readonly<{
  year: number;
  /** Afledt af projektionen, ikke restateret: satstabellens form ejes af `getSatserForYear`. */
  satser: SatserProjectionValue['satser'];
  stamdata: StamdataValues;
}>;

export const satserDocumentDefinition: MineoDocumentDefinition<SatserDocumentInput> =
  defineMineoDocument({
    id: 'satser',
    brevhoved: { kind: 'settings-key', key: 'satser' },
    labels: { documentName: 'satser' },
    project: (context) => {
      const { reader } = context.evaluation;
      // Klassen UDLEDES af issuene (§3.1). Før citerede begge grene `issues[0]` ubetinget, så et tomt
      // satsår gav "Satsår er ikke udfyldt" som ordret citat frem for den universelle "Indtastning
      // mangler" – modsat den `missing`-klasse, issuet selv bærer.
      const projection = projectSatser(reader);
      if (projection.status !== 'ready') {
        return blockedProjectionFromCauses('satser:year-blocked', projection.issues, 'Satsåret er ikke gyldigt');
      }

      const stamdata = projectStamdataForDocument(reader, SATSER_DOCUMENT_CONSUMER_ID);
      if (stamdata.status !== 'ready') {
        return blockedProjectionFromCauses('satser:stamdata-blocked', stamdata.issues, 'Stamdata indeholder fejl');
      }

      return {
        status: 'ready',
        input: {
          year: projection.value.year,
          satser: projection.value.satser,
          stamdata: stamdata.value,
        },
      };
    },
    loadRenderer: async () => {
      const { generateSatserDocument } = await import('../../document/generators/satser/satserDocument');
      return (session, input, ctx) => generateSatserDocument(session, input.year, input.satser, {
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });
