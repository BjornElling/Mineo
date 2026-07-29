/**
 * Renteberegningens to dokumentdefinitioner (Fase 5; `document-output-contract.md` §A1.2/§A7.1).
 *
 * `rente-oversigt` er ét samlet dokument over alle rentekrav-rækker; `rente` er specifikationen for
 * ÉN række og er derfor det første output med en ægte aktiveringsidentitet (`TRequest = RenteRowRequest`).
 *
 * **Hvad Fase 5 ensarter her.** Før Fase 5 gentog `RenteberegningTab` sin gate-prelude fire steder:
 * to reaktive `useMemo`-gates og to click-handlere kontrollerede hver for sig
 * `stamdataProjection.status === 'blocked'` og `aggregateProjection.status === 'blocked'`, FØR de
 * kaldte den egentlige `evaluate*DownloadGate`. Preluden var altså en selvstændig gate, som
 * domænelaget ikke kendte — og de fire kopier kunne drifte. Nu ligger hele kæden i `project`.
 *
 * Begge outputs deler ÉN `buildRenteberegningReaderProjection` gennem `context.shared`, så
 * række-projektionerne (som kalder rentemotoren pr. række) kun beregnes én gang pr. kildekontekst,
 * uanset hvor mange download-knapper siden tegner.
 */
import { referenceRates, surchargeRates } from '../../data/interestRates';
import type { DocumentProjectionResult } from '../../document/definition/documentDefinition';
import {
  defineMineoDocument,
  type MineoDocumentDefinition,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import { toGateReasons } from '../../document/definition/documentOutcome';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';
import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';
import { renteberegningBeregningsdatoField, renteberegningKommentarerField } from '../../inputCore/catalog/renteberegningDescriptors';
import type { StamdataValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import { projectStamdataForDocument } from '../stamdata/stamdataDocumentProjection';
import type { ProcessInterestPeriod } from './procesrenteCalculator';
import { evaluateOversigtDownloadGate } from './renteberegningDownloadGate';
import {
  buildRenteberegningReaderProjection,
  type RenteberegningReaderProjection,
} from './renteberegningReaderProjection';

export const RENTEBEREGNING_DOCUMENT_CONSUMER_ID = 'document.renteberegning';

const beregningsdatoRef = renteberegningBeregningsdatoField.bind();
const kommentarerRef = renteberegningKommentarerField.bind();

/**
 * Den fælles renteberegnings-kilde. Rentesatstabellerne er statiske moduldata og er derfor en
 * konstant dependency, ikke en del af kildesnapshottet.
 */
type SharedRenteSource = Readonly<{
  projection: RenteberegningReaderProjection;
  stamdata: ReturnType<typeof projectStamdataForDocument>;
  beregningsdato: ISODateString | undefined;
  kommentarer: string | undefined;
}>;

/** Builderen er selv memo-nøglen, så begge outputs deler ét slot pr. kildekontekst. */
const readSharedRenteSource = (
  context: DocumentSourceContext<MineoDocumentGateSettings>
): SharedRenteSource => {
  const { reader } = context.evaluation;
  const beregningsdato = reader.read(beregningsdatoRef);
  const kommentarer = reader.read(kommentarerRef);
  return {
    projection: buildRenteberegningReaderProjection({ reader, referenceRates, surchargeRates }),
    stamdata: projectStamdataForDocument(reader, RENTEBEREGNING_DOCUMENT_CONSUMER_ID),
    beregningsdato: beregningsdato.status === 'usable' ? beregningsdato.value : undefined,
    kommentarer: kommentarer.status === 'usable' ? kommentarer.value : undefined,
  };
};

/**
 * Den fælles prelude for begge outputs: stamdata er en obligatorisk dokumentdependency, og
 * aggregat-projektionen skal være `ready`, før nogen af de to gates kan udtale sig. Var før
 * duplikeret i fire udtryk i `RenteberegningTab`.
 */
const requireReadyAggregate = <TInput>(
  source: SharedRenteSource
):
  | Readonly<{ kind: 'blocked'; result: DocumentProjectionResult<TInput> }>
  | Readonly<{ kind: 'ok'; stamdata: StamdataValues; aggregate: NonNullable<ReturnType<typeof readAggregate>> }> => {
  if (source.stamdata.status !== 'ready') {
    return {
      kind: 'blocked',
      result: {
        status: 'blocked',
        reasons: [{
          code: 'renteberegning:stamdata-blocked',
          message: source.stamdata.status === 'blocked'
            ? source.stamdata.issues[0]?.message ?? 'Stamdata indeholder fejl'
            : 'Stamdata indeholder fejl',
        }],
      },
    };
  }
  const aggregate = readAggregate(source);
  if (aggregate === null) {
    return {
      kind: 'blocked',
      result: {
        status: 'blocked',
        reasons: [{
          code: 'renteberegning:field-error',
          message: source.projection.aggregateProjection.status === 'blocked'
            ? source.projection.aggregateProjection.issues[0]?.message ?? 'Fejl i indtastning'
            : 'Fejl i indtastning',
        }],
      },
    };
  }
  return { kind: 'ok', stamdata: source.stamdata.value, aggregate };
};

const readAggregate = (source: SharedRenteSource) =>
  source.projection.aggregateProjection.status === 'ready' ? source.projection.aggregateProjection.value : null;

// ---------------------------------------------------------------------------------------------
// rente-oversigt
// ---------------------------------------------------------------------------------------------

export type RenteOversigtDocumentInput = Readonly<{
  beregningsdato: ISODateString;
  rows: readonly RenteOversigtRow[];
  latestReferenceRateDate: ISODateString | null;
  kommentarer: string | undefined;
  stamdata: StamdataValues;
}>;

/**
 * Den seneste referencerentedato på tværs af rækkerne. Var før en løkke i click-handleren; den er en
 * ren afledning af projektionen og hører derfor i definitionen.
 */
const resolveLatestReferenceRateDate = (
  pdfContexts: ReadonlyMap<string, Readonly<{ latestReferenceRateDate: ISODateString | null }>>
): ISODateString | null => {
  let latest: ISODateString | null = null;
  for (const ctx of pdfContexts.values()) {
    if (ctx.latestReferenceRateDate === null) continue;
    if (latest === null || ctx.latestReferenceRateDate > latest) latest = ctx.latestReferenceRateDate;
  }
  return latest;
};

export const renteOversigtDocumentDefinition: MineoDocumentDefinition<RenteOversigtDocumentInput> =
  defineMineoDocument({
    id: 'rente-oversigt',
    brevhoved: { kind: 'settings-key', key: 'renteberegning' },
    labels: { documentName: 'rente-oversigt' },
    project: (context) => {
      const source = context.shared(readSharedRenteSource);
      const ready = requireReadyAggregate<RenteOversigtDocumentInput>(source);
      if (ready.kind === 'blocked') return ready.result;

      const gate = evaluateOversigtDownloadGate({
        beregningsdato: source.beregningsdato,
        hasValidPdfContexts: ready.aggregate.pdfContexts.size > 0,
        anyRowHasError: ready.aggregate.anyRowHasError,
        // Feltfejl på beregningsdato fanges allerede af aggregat-projektionen ovenfor; den ville
        // gøre den `blocked`. Flaget er derfor altid false her — bevaret for at kalde gaten med dens
        // fulde, uændrede signatur (§5.4).
        beregningsdatoHasError: false,
      });
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'rente-oversigt:blocked',
            message: 'Oversigten kan ikke hentes',
          }),
        };
      }
      // Gaten har netop afvist `undefined`; gentagelsen er typeindsnævring, ikke en selvstændig gate.
      if (source.beregningsdato === undefined) {
        return {
          status: 'blocked',
          reasons: [{ code: 'renteberegning:missing-beregningsdato', message: 'Beregningsdato mangler' }],
        };
      }

      const rows: RenteOversigtRow[] = Array.from(ready.aggregate.pdfContexts.values()).map((ctx) => ({
        beloeb: ctx.beloeb,
        renterFra: ctx.actualInterestDate,
        beregnetRente: ctx.calculatedInterest,
      }));

      return {
        status: 'ready',
        input: {
          beregningsdato: source.beregningsdato,
          rows,
          latestReferenceRateDate: resolveLatestReferenceRateDate(ready.aggregate.pdfContexts),
          kommentarer: source.kommentarer,
          stamdata: ready.stamdata,
        },
      };
    },
    loadRenderer: async () => {
      const { generateRenteOversigtDocument } = await import(
        '../../document/generators/renteberegning/renteOversigtDocument'
      );
      return (session, input, ctx) => generateRenteOversigtDocument(
        session,
        input.beregningsdato,
        input.rows,
        {
          visBrevhoved: ctx.visBrevhoved,
          stamdata: input.stamdata,
          kommentarer: input.kommentarer,
          latestReferenceRateDate: input.latestReferenceRateDate,
        }
      );
    },
  });

// ---------------------------------------------------------------------------------------------
// rente (pr. række)
// ---------------------------------------------------------------------------------------------

/**
 * Aktiveringsidentiteten for `rente`: hvilken rentekrav-række brugeren klikkede på.
 *
 * KUN identiteten — rækkens beregnede `pdfContext` bæres bevidst IKKE med. Requesten dannes ved klik,
 * altså før commit-barrieren; et medbragt resultat ville stamme fra den forrige revision. `project`
 * slår derfor `rowId` op i det FRISKE snapshot og fail-closer, hvis rækken er forsvundet eller ikke
 * længere har et gyldigt resultat.
 */
export type RenteRowRequest = Readonly<{ rowId: string }>;

export type RenteDocumentInput = Readonly<{
  beloeb: number;
  actualInterestDate: ISODateString;
  beregningsdato: ISODateString;
  periods: readonly ProcessInterestPeriod[];
  latestReferenceRateDate: ISODateString | null;
  kommentarer: string | undefined;
  stamdata: StamdataValues;
}>;

export const renteDocumentDefinition: MineoDocumentDefinition<RenteDocumentInput, RenteRowRequest> =
  defineMineoDocument({
    id: 'rente',
    brevhoved: { kind: 'settings-key', key: 'renteberegning' },
    labels: { documentName: 'rentespecifikation' },
    project: (context, request) => {
      const source = context.shared(readSharedRenteSource);
      if (source.stamdata.status !== 'ready') {
        return {
          status: 'blocked',
          reasons: [{
            code: 'renteberegning:stamdata-blocked',
            message: source.stamdata.status === 'blocked'
              ? source.stamdata.issues[0]?.message ?? 'Stamdata indeholder fejl'
              : 'Stamdata indeholder fejl',
          }],
        };
      }

      // Frisk opslag af den aktiverede række. Rækken kan være slettet eller ændret siden klikket.
      const rowProjection = source.projection.rowProjections.get(request.rowId);
      if (rowProjection === undefined) {
        return {
          status: 'blocked',
          reasons: [{ code: 'rente:row-missing', message: 'Rentelinjen findes ikke længere' }],
        };
      }
      if (rowProjection.status !== 'ready') {
        return {
          status: 'blocked',
          reasons: [{
            code: 'rente:row-blocked',
            message: rowProjection.status === 'blocked'
              ? rowProjection.issues[0]?.message ?? 'Rentelinjen er ugyldig'
              : 'Rentelinjen er ugyldig',
          }],
        };
      }
      const pdfContext = rowProjection.value.pdfContext;
      if (pdfContext === null) {
        return {
          status: 'blocked',
          reasons: [{ code: 'rente:row-no-result', message: 'Rentelinjen har ingen beregning' }],
        };
      }

      return {
        status: 'ready',
        input: {
          beloeb: pdfContext.beloeb,
          actualInterestDate: pdfContext.actualInterestDate,
          beregningsdato: pdfContext.beregningsdato,
          periods: pdfContext.periods,
          latestReferenceRateDate: pdfContext.latestReferenceRateDate,
          kommentarer: source.kommentarer,
          stamdata: source.stamdata.value,
        },
      };
    },
    /**
     * **Datoformat er en ÆGTE grænse her, ikke en detalje.** `generateRenteDocument` tager
     * `dd-mm-åååå` og parser med `parseDanishDate`; sender man den canonical ISO-form, kaster den
     * "Ugyldige datoer for renteberegning". Callsiten konverterede før Fase 5 alle TRE datoer med
     * `isoToDanish`, og den konvertering skal med her — ellers fejler hver eneste enkeltrente-download.
     *
     * Den rigtige langsigtede rettelse er at gøre generatorens kontrakt til `ISODateString` (canonical
     * ind, formatering i generatoren). Det ligger uden for Fase 5, som eksplicit bevarer
     * generatorsignaturerne uændrede — se WI-011.
     */
    loadRenderer: async () => {
      const [{ generateRenteDocument }, { isoToDanish }] = await Promise.all([
        import('../../document/generators/renteberegning/renteDocument'),
        import('../../types/branded'),
      ]);
      return (session, input, ctx) => generateRenteDocument(
        session,
        input.beloeb,
        toDanishOrThrow(isoToDanish(input.actualInterestDate), 'renterFra'),
        toDanishOrThrow(isoToDanish(input.beregningsdato), 'beregningsdato'),
        input.periods,
        {
          visBrevhoved: ctx.visBrevhoved,
          stamdata: input.stamdata,
          kommentarer: input.kommentarer,
          latestReferenceRateDate: isoToDanish(input.latestReferenceRateDate ?? undefined) ?? null,
        }
      );
    },
  });

/**
 * En canonical ISO-dato, der ikke kan omsættes til dansk format, er et invariantbrud — projektionen
 * har netop godkendt den. Fail-closed med en navngiven årsag frem for at sende `undefined` videre og
 * få generatorens generiske "Ugyldige datoer".
 */
const toDanishOrThrow = (value: string | undefined, felt: string): string => {
  if (value === undefined) {
    throw new Error(`Kunne ikke omsætte ${felt} til dansk datoformat i rentespecifikationen.`);
  }
  return value;
};
