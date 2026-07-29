/**
 * Standalone MinProcesrentes tre dokumentdefinitioner (Fase 5, pass 6;
 * `document-output-contract.md` §A2a).
 *
 * De tre outputs er `standalone-rente` (én rentekrav-række), `standalone-rente-alle` (alle rækkers
 * specifikationer samlet i ÉT dokument — kun mobil) og `standalone-rente-oversigt` (oversigtstabellen).
 *
 * **Hvad Fase 5 retter her.** Standalone havde INGEN commit-barriere og ingen gate: `handleDownload*`
 * i `MinProcesrenteCalculatorPage` kaldte `standaloneRentePdfService.ts` direkte med rækkedata, som
 * `RenteberegningTab` allerede havde beregnet, og servicelaget nøjedes med en
 * friskheds-closure. Nu går alle tre gennem den samme livscyklus som hovedappens 18, med den
 * ENE forskel, at miljøet er standalones (fast PDF, intet brevhoved, lokal fejl-sink).
 *
 * **Hvorfor projektionen genlæses her og ikke genbruges fra hovedappens definitioner.** Mineos
 * `renteberegningDocumentDefinitions.ts` kræver `SourceSettings` og en `stamdata`-dependency,
 * som standalone hverken har eller må importere. Domænelogikken deles hvor det tæller — samme
 * `buildRenteberegningReaderProjection`, samme `evaluateOversigtDownloadGate`, samme generatorer — men
 * settings-bindingen kan ikke deles, og skal ikke være det.
 */
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import type { DocumentDefinition, DocumentProjectionResult } from '../../../document/definition/documentDefinition';
import {
  blockedFromIssues,
  blockedProjection,
  toGateReasons,
} from '../../../document/definition/documentOutcome';
import type { DocumentSourceContext } from '../../../document/definition/documentSourceContext';
import { defineDocumentOutput } from '../../../document/definition/documentDefinition';
import type { RenteOversigtRow } from '../../../document/generators/renteberegning/renteOversigtDocument';
import { renteberegningBeregningsdatoField, renteberegningKommentarerField } from '../../../inputCore/catalog/renteberegningDescriptors';
import type { ProcessInterestPeriod } from '../../../domain/renteberegning/procesrenteCalculator';
import {
  evaluateDownloadAllGate,
  evaluateOversigtDownloadGate,
} from '../../../domain/renteberegning/renteberegningDownloadGate';
import {
  buildRenteberegningReaderProjection,
  type RenteberegningReaderProjection,
} from '../../../domain/renteberegning/renteberegningReaderProjection';
import type { ISODateString } from '../../../types/branded';

/**
 * Standalones definitionsform. `TSettings = void` og `TBrevhovedKey = never` — se
 * `standaloneDocumentEnvironment.ts` for hvorfor de to ikke er dummy-værdier.
 */
type StandaloneDocumentDefinition<TInput, TRequest = void> = DocumentDefinition<TRequest, TInput, void, never>;

const defineStandaloneDocument = <TInput, TRequest = void>(
  definition: StandaloneDocumentDefinition<TInput, TRequest>
): StandaloneDocumentDefinition<TInput, TRequest> => defineDocumentOutput(definition);

const beregningsdatoRef = renteberegningBeregningsdatoField.bind();
const kommentarerRef = renteberegningKommentarerField.bind();

/** Standalones fælles rentekilde. Alle tre outputs deler ét slot pr. kildekontekst. */
type SharedStandaloneRenteSource = Readonly<{
  projection: RenteberegningReaderProjection;
  beregningsdato: ISODateString | undefined;
  kommentarer: string | undefined;
}>;

const readSharedStandaloneRenteSource = (
  context: DocumentSourceContext<void>
): SharedStandaloneRenteSource => {
  const { reader } = context.evaluation;
  const beregningsdato = reader.read(beregningsdatoRef);
  const kommentarer = reader.read(kommentarerRef);
  return {
    projection: buildRenteberegningReaderProjection({ reader, referenceRates, surchargeRates }),
    beregningsdato: beregningsdato.status === 'usable' ? beregningsdato.value : undefined,
    kommentarer: kommentarer.status === 'usable' ? kommentarer.value : undefined,
  };
};

/**
 * Aggregatet skal være `ready`, før nogen af de tre gates kan udtale sig. Modsvarer hovedappens
 * `requireReadyAggregate`, men uden stamdata-dependencyen, som standalone ikke har.
 */
const requireReadyAggregate = <TInput>(
  source: SharedStandaloneRenteSource
):
  | Readonly<{ kind: 'blocked'; result: DocumentProjectionResult<TInput> }>
  | Readonly<{ kind: 'ok'; aggregate: NonNullable<ReturnType<typeof readAggregate>> }> => {
  const aggregate = readAggregate(source);
  if (aggregate === null) {
    return {
      kind: 'blocked',
      result: blockedFromIssues(
        'renteberegning:field-error',
        source.projection.aggregateProjection.status === 'blocked'
          ? source.projection.aggregateProjection.issues
          : undefined,
        'Fejl i indtastning'
      ),
    };
  }
  return { kind: 'ok', aggregate };
};

const readAggregate = (source: SharedStandaloneRenteSource) =>
  source.projection.aggregateProjection.status === 'ready' ? source.projection.aggregateProjection.value : null;

/** Den seneste referencerentedato på tværs af rækkerne. */
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

// ---------------------------------------------------------------------------------------------
// standalone-rente (pr. række)
// ---------------------------------------------------------------------------------------------

export type StandaloneRenteRowRequest = Readonly<{ rowId: string }>;

export type StandaloneRenteDocumentInput = Readonly<{
  beloeb: number;
  actualInterestDate: ISODateString;
  beregningsdato: ISODateString;
  periods: readonly ProcessInterestPeriod[];
  latestReferenceRateDate: ISODateString | null;
  kommentarer: string | undefined;
}>;

export const standaloneRenteDocumentDefinition: StandaloneDocumentDefinition<
  StandaloneRenteDocumentInput,
  StandaloneRenteRowRequest
> = defineStandaloneDocument({
  id: 'standalone-rente',
  brevhoved: { kind: 'none' },
  labels: { documentName: 'rentespecifikation' },
  project: (context, request) => {
    const source = context.shared(readSharedStandaloneRenteSource);

    // Frisk opslag af den aktiverede række; den kan være slettet eller ændret siden klikket.
    const rowProjection = source.projection.rowProjections.get(request.rowId);
    if (rowProjection === undefined) {
      return blockedProjection('rente:row-missing', 'Rentelinjen findes ikke længere');
    }
    if (rowProjection.status !== 'ready') {
      return blockedFromIssues(
        'rente:row-blocked',
        rowProjection.status === 'blocked' ? rowProjection.issues : undefined,
        'Rentelinjen er ugyldig'
      );
    }
    const pdfContext = rowProjection.value.pdfContext;
    if (pdfContext === null) {
      return blockedProjection('rente:row-no-result', 'Rentelinjen har ingen beregning');
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
      },
    };
  },
  /**
   * Datoerne gives videre CANONICAL (§WI-011): begge rente-generatorer tager nu `ISODateString`, så
   * konverteringen til dansk format — og dens fail-closed-guard — er faldet væk her.
   */
  loadRenderer: async () => {
    const { generateRenteDocument } = await import('../../../document/generators/renteberegning/renteDocument');
    return (session, input) => generateRenteDocument(
      session,
      input.beloeb,
      input.actualInterestDate,
      input.beregningsdato,
      input.periods,
      {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: input.kommentarer,
        latestReferenceRateDate: input.latestReferenceRateDate ?? null,
        metadata: STANDALONE_DOCUMENT_METADATA,
      }
    );
  },
});

// `requireDanishDate` er slettet med §WI-011: den fail-closede på en ISO→dansk-konvertering, der ikke længere
// findes. Generatoren tager canonical ISO, så formatuenigheden er urepræsenterbar frem for noget en guard pr.
// callsite skal fange.

/** Standalones dokument-metadata. Hovedappen sætter sine egne; standalone er minprocesrente.dk. */
const STANDALONE_DOCUMENT_METADATA = {
  subject: 'Renteberegning',
  author: 'minprocesrente.dk',
} as const;

// ---------------------------------------------------------------------------------------------
// standalone-rente-alle (alle rækkers specifikationer i ét dokument)
// ---------------------------------------------------------------------------------------------

/**
 * Én række i det samlede specifikationsdokument. Bemærk at inputtet er en LISTE og ikke en request:
 * outputtet gælder ALLE gyldige rækker, ikke et brugervalgt udsnit, så der er ingen
 * aktiveringsidentitet at bære (`TRequest = void`). Rækkerne udledes af den friske projektion i
 * `project`, præcis som de øvrige outputs' input.
 */
export type StandaloneRenteAlleRow = Readonly<{
  beloeb: number;
  actualInterestDate: ISODateString;
  beregningsdato: ISODateString;
  periods: readonly ProcessInterestPeriod[];
  latestReferenceRateDate: ISODateString | null;
}>;

export type StandaloneRenteAlleDocumentInput = Readonly<{
  rows: readonly StandaloneRenteAlleRow[];
  kommentarer: string | undefined;
}>;

export const standaloneRenteAlleDocumentDefinition: StandaloneDocumentDefinition<StandaloneRenteAlleDocumentInput> =
  defineStandaloneDocument({
    id: 'standalone-rente-alle',
    brevhoved: { kind: 'none' },
    labels: { documentName: 'rentespecifikationer' },
    project: (context) => {
      const source = context.shared(readSharedStandaloneRenteSource);
      const ready = requireReadyAggregate<StandaloneRenteAlleDocumentInput>(source);
      if (ready.kind === 'blocked') return ready.result;

      const gate = evaluateDownloadAllGate({
        hasValidPdfContexts: ready.aggregate.pdfContexts.size > 0,
        anyRowHasError: ready.aggregate.anyRowHasError,
        // Feltfejl på beregningsdato ville allerede have gjort aggregat-projektionen blokeret.
        beregningsdatoHasError: false,
      });
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'standalone-rente-alle:blocked',
            message: 'Specifikationerne kan ikke hentes',
          }),
        };
      }

      const rows: StandaloneRenteAlleRow[] = Array.from(ready.aggregate.pdfContexts.values()).map((ctx) => ({
        beloeb: ctx.beloeb,
        actualInterestDate: ctx.actualInterestDate,
        beregningsdato: ctx.beregningsdato,
        periods: ctx.periods,
        latestReferenceRateDate: ctx.latestReferenceRateDate,
      }));
      if (rows.length === 0) {
        return blockedProjection('standalone-rente-alle:no-rows', 'Ingen rækker at downloade');
      }

      return { status: 'ready', input: { rows, kommentarer: source.kommentarer } };
    },
    /**
     * Det ene output, der komponerer flere dokumenter i ÉN artifact frem for at kalde én generator.
     * `DocumentRenderer` kræver kun en `DocumentArtifact` tilbage, så kompositionen hører hjemme her —
     * i definitionen, sammen med den tunge import — og ikke i kernen.
     */
    loadRenderer: async () => {
      const [{ buildRenteDocumentBaseTitle, writeRenteDocumentContent }, { createDocumentComposer }, { resolveDocumentArtifactFileName }, { getDocumentCreatorBrand }, { parseISODate }] =
        await Promise.all([
          import('../../../document/generators/renteberegning/renteDocument'),
          import('../../../document/model/documentModel'),
          import('../../../document/layout/documentFormatUtils'),
          import('../../../document/layout/documentLayoutHelpers'),
          import('../../../types/branded'),
        ]);

      return async (session, input) => {
        const { composer, build } = createDocumentComposer();

        for (const [index, row] of input.rows.entries()) {
          if (index > 0) composer.addPage();

          // Canonical ISO parses DIREKTE (§WI-011). Vejen gik tidligere ISO → dansk streng → `Date`, altså
          // to formatskift for at nå den samme dato — og et `?? ''`, der gjorde en manglende konvertering til
          // en "ugyldig dato" frem for til en typefejl.
          const startDate = parseISODate(row.actualInterestDate);
          const endDate = parseISODate(row.beregningsdato);
          if (!startDate || !endDate) throw new Error('Ugyldige datoer for renteberegning');
          if (row.periods.length === 0) throw new Error('Ingen perioder fundet for renteberegning');

          writeRenteDocumentContent(composer, row.beloeb, startDate, endDate, row.periods, {
            visBrevhoved: false,
            stamdata: null,
            kommentarer: input.kommentarer,
            latestReferenceRateDate: row.latestReferenceRateDate ?? null,
          });
        }

        composer.addFooter();
        const blob = await session.render({
          model: build(),
          properties: {
            title: 'Procesrente',
            subject: STANDALONE_DOCUMENT_METADATA.subject,
            author: STANDALONE_DOCUMENT_METADATA.author,
            creator: getDocumentCreatorBrand(),
          },
        });

        const firstRow = input.rows[0];
        const firstStart = parseISODate(firstRow.actualInterestDate);
        const firstEnd = parseISODate(firstRow.beregningsdato);
        const baseTitle = firstStart && firstEnd
          ? buildRenteDocumentBaseTitle(firstRow.beloeb, firstStart, firstEnd)
          : 'Procesrente-specifikationer';
        const suffix = input.rows.length > 1 ? ` +${input.rows.length - 1}` : '';
        return { blob, filename: resolveDocumentArtifactFileName(`${baseTitle}${suffix}`, false) };
      };
    },
  });

// ---------------------------------------------------------------------------------------------
// standalone-rente-oversigt
// ---------------------------------------------------------------------------------------------

export type StandaloneRenteOversigtDocumentInput = Readonly<{
  beregningsdato: ISODateString;
  rows: readonly RenteOversigtRow[];
  latestReferenceRateDate: ISODateString | null;
  kommentarer: string | undefined;
}>;

export const standaloneRenteOversigtDocumentDefinition: StandaloneDocumentDefinition<StandaloneRenteOversigtDocumentInput> =
  defineStandaloneDocument({
    id: 'standalone-rente-oversigt',
    brevhoved: { kind: 'none' },
    labels: { documentName: 'rente-oversigt' },
    project: (context) => {
      const source = context.shared(readSharedStandaloneRenteSource);
      const ready = requireReadyAggregate<StandaloneRenteOversigtDocumentInput>(source);
      if (ready.kind === 'blocked') return ready.result;

      const gate = evaluateOversigtDownloadGate({
        beregningsdato: source.beregningsdato,
        hasValidPdfContexts: ready.aggregate.pdfContexts.size > 0,
        anyRowHasError: ready.aggregate.anyRowHasError,
        beregningsdatoHasError: false,
      });
      if (!gate.canDownload) {
        return {
          status: 'blocked',
          reasons: toGateReasons(gate.reasons, {
            code: 'standalone-rente-oversigt:blocked',
            message: 'Oversigten kan ikke hentes',
          }),
        };
      }
      // Gaten har netop afvist `undefined`; gentagelsen er typeindsnævring, ikke en selvstændig gate.
      if (source.beregningsdato === undefined) {
        return blockedProjection('renteberegning:missing-beregningsdato', 'Beregningsdato mangler');
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
        },
      };
    },
    loadRenderer: async () => {
      const { generateRenteOversigtDocument } = await import(
        '../../../document/generators/renteberegning/renteOversigtDocument'
      );
      return (session, input) => generateRenteOversigtDocument(session, input.beregningsdato, input.rows, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer: input.kommentarer,
        latestReferenceRateDate: input.latestReferenceRateDate,
        metadata: STANDALONE_DOCUMENT_METADATA,
      });
    },
  });
