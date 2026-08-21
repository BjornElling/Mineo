/**
 * Årsløns to dokumentdefinitioner.
 *
 * Begge deler ÉN `buildAarsloenReaderProjection` gennem `context.shared`, så årslønsmotoren kun kaldes
 * én gang pr. kildekontekst, selvom siden tegner to download-knapper.
 *
 * Gate-reglerne ligger i `aarsloenDownloadGate.ts` – flyttet fra `src/hooks/useAarsloenDocumentGates.ts`
 * og ensartet til at læse projektionen frem for et komponent-samlet snapshot (se modulets egen
 * forklaring). Reglerne er uændrede.
 */
import {
  defineMineoDocument,
  type MineoDocumentDefinition,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import { blockedProjection, blockedProjectionForStamdata, toGateReasons } from '../../document/definition/documentOutcome';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';
import type { StamdataValues } from '../../schemas/formSchemas';
import type { AarsloenBeregningResult } from '../../types/calculation';
import type { PeriodeResult } from '../../utils/periodeBeregning';
import type { Loenperiode } from '../../types/loen';
import type { AarsloenValues } from '../../schemas/formSchemas';
import { buildAarsloenReaderProjection, type AarsloenReaderProjection } from './aarsloenProjection';
import { evaluateAarsloenDownloadGate, evaluateShDageDownloadGate } from './aarsloenDownloadGate';
import { projectStamdataForDocumentIfEnabled } from '../stamdata/stamdataDocumentProjection';

/** Builderen er selv memo-nøglen, så begge outputs deler ét slot pr. kildekontekst. */
const readSharedAarsloenSource = (
  context: DocumentSourceContext<MineoDocumentGateSettings>
): AarsloenReaderProjection => buildAarsloenReaderProjection(context.evaluation.reader);

/**
 * Årslønsdokumentets brevhoved-stamdata er BEVIDST indsnævret til tre felter. Generatoren skal ikke
 * have hele `StamdataValues`.
 */
type AarsloenDocumentStamdata = Readonly<{
  journalnr: string | undefined;
  advokat: string | undefined;
  sagsbehandler: string | undefined;
}>;

const narrowStamdata = (stamdata: StamdataValues): AarsloenDocumentStamdata => ({
  journalnr: stamdata.journalnr,
  advokat: stamdata.advokat,
  sagsbehandler: stamdata.sagsbehandler,
});

// ---------------------------------------------------------------------------------------------
// aarsloen
// ---------------------------------------------------------------------------------------------

export type AarsloenDocumentInput = Readonly<{
  satser: Readonly<{
    feriePct: number | undefined;
    fritvalgPct: number | undefined;
    shSoPct: number | undefined;
    storeBededagPct: number | undefined;
    pensionPct: number | undefined;
  }>;
  loenperiode: Loenperiode;
  tillaegAngivesSom: AarsloenValues['tillaegAngivesSom'];
  tableData: AarsloenValues['tableData'];
  beregnetAarsloen: number;
  omregningTilFuldtAar: boolean;
  periodeData: PeriodeResult | null;
  fuldLoenUnderFerie: AarsloenValues['fuldLoenUnderFerie'];
  retTilSjetteFerieuge: AarsloenValues['retTilSjetteFerieuge'];
  antalFeriedage: AarsloenValues['antalFeriedage'];
  loenPaaHelligdage: AarsloenValues['loenPaaHelligdage'];
  shDageAntal: number | null;
  beregningsData: AarsloenBeregningResult;
  stamdata: AarsloenDocumentStamdata;
}>;

export const aarsloenDocumentDefinition: MineoDocumentDefinition<AarsloenDocumentInput> =
  defineMineoDocument({
    id: 'aarsloen',
    brevhoved: { kind: 'settings-key', key: 'aarsloensberegning' },
    labels: { documentName: 'årsløn' },
    project: (context) => {
      const projection = context.shared(readSharedAarsloenSource);
      const gate = evaluateAarsloenDownloadGate(projection);
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'aarsloen:blocked',
            message: 'Årslønsberegningen kan ikke hentes',
          }),
        };
      }
      // Gaten har netop udelukket begge tilfælde; gentagelsen er typeindsnævring og fail-closed
      // sikkerhedsnet, ikke en selvstændig gate.
      const { calculation, values } = projection;
      const documentStamdata = projectStamdataForDocumentIfEnabled(
        context.evaluation.reader,
        'document.aarsloen',
        context.settings.brevhovedIndstillinger.aarsloensberegning
      );
      if (calculation === null) {
        return blockedProjection('aarsloen:no-result', 'Årslønsberegningen kan ikke dannes');
      }
      if (documentStamdata.status !== 'ready') {
        return blockedProjectionForStamdata('aarsloen:stamdata-blocked');
      }

      return {
        status: 'ready',
        input: {
          satser: {
            feriePct: values.feriePct,
            fritvalgPct: values.fritvalgPct,
            shSoPct: values.shSoPct,
            storeBededagPct: values.storeBededagPct,
            pensionPct: values.pensionPct,
          },
          loenperiode: values.loenperiode,
          tillaegAngivesSom: values.tillaegAngivesSom,
          tableData: values.tableData,
          beregnetAarsloen: calculation.beregnetAarsloen,
          omregningTilFuldtAar: projection.omregningGate.effectiveEnabled,
          periodeData: calculation.periodeData,
          fuldLoenUnderFerie: values.fuldLoenUnderFerie,
          retTilSjetteFerieuge: values.retTilSjetteFerieuge,
          antalFeriedage: values.antalFeriedage,
          loenPaaHelligdage: values.loenPaaHelligdage,
          shDageAntal: calculation.shDageAntal,
          beregningsData: calculation.beregningsData,
          stamdata: narrowStamdata(documentStamdata.value),
        },
      };
    },
    loadRenderer: async () => {
      const { generateAarsloenDocument } = await import('../../document/generators/aarsloen/aarsloenDocument');
      return (session, input, ctx) => generateAarsloenDocument(session, {
        satser: input.satser,
        loenperiode: input.loenperiode,
        tillaegAngivesSom: input.tillaegAngivesSom,
        tableData: input.tableData,
        beregnetAarsloen: input.beregnetAarsloen,
        omregningTilFuldtAar: input.omregningTilFuldtAar,
        periodeData: input.periodeData,
        fuldLoenUnderFerie: input.fuldLoenUnderFerie,
        retTilSjetteFerieuge: input.retTilSjetteFerieuge,
        antalFeriedage: input.antalFeriedage,
        loenPaaHelligdage: input.loenPaaHelligdage,
        shDageAntal: input.shDageAntal,
        beregningsData: input.beregningsData,
        stamdata: input.stamdata,
        visBrevhoved: ctx.visBrevhoved,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// sh-dage
// ---------------------------------------------------------------------------------------------

export type ShDageDocumentInput = Readonly<{
  /**
   * `PeriodeResult['perioder']` direkte – ikke en parallel `readonly SHDagePeriod[]`. Generatorens
   * `defineDocument`-parametertype er `DateInterval[]`, og et `readonly`-array kan ikke tildeles den;
   * at genbruge kildens egen type er både korrekt og ét sted mindre at holde i sync.
   */
  perioder: PeriodeResult['perioder'];
  stamdata: StamdataValues;
}>;

export const shDageDocumentDefinition: MineoDocumentDefinition<ShDageDocumentInput> =
  defineMineoDocument({
    id: 'sh-dage',
    brevhoved: { kind: 'settings-key', key: 'shDage' },
    labels: { documentName: 'SH-dage' },
    project: (context) => {
      const projection = context.shared(readSharedAarsloenSource);
      const gate = evaluateShDageDownloadGate(projection);
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'sh-dage:blocked',
            message: 'SH-dage-dokumentet kan ikke hentes',
          }),
        };
      }
      const { calculation } = projection;
      const documentStamdata = projectStamdataForDocumentIfEnabled(
        context.evaluation.reader,
        'document.aarsloen',
        context.settings.brevhovedIndstillinger.shDage
      );
      if (calculation?.periodeData == null) {
        return blockedProjection('sh-dage:no-result', 'SH-dage kan ikke dannes');
      }
      if (documentStamdata.status !== 'ready') {
        return blockedProjectionForStamdata('sh-dage:stamdata-blocked');
      }

      return {
        status: 'ready',
        input: {
          perioder: calculation.periodeData.perioder ?? [],
          stamdata: documentStamdata.value,
        },
      };
    },
    loadRenderer: async () => {
      const { generateSHDageDocument } = await import('../../document/generators/aarsloen/shDageDocument');
      return (session, input, ctx) => generateSHDageDocument(session, input.perioder, {
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });
