/**
 * De fire EET-dokumentdefinitioner (Fase 5; `document-output-contract.md` §A1.2/§A7.1).
 *
 * De fire faner deler ÉN `buildErhvervsevnetabReaderProjection` og ÉT gate-sæt gennem
 * `context.shared`, men gates uafhængigt pr. fane (§1.10): en fejl i EAL-delen må ikke blokere
 * kapitaliserings-downloaden.
 *
 * **Ensartning i forhold til før Fase 5.** Tab-komponenterne kaldte `evaluateEetFaneDownloadGate`
 * direkte og tjekkede derefter `documentStamdata.status !== 'ready'` som en SELVSTÆNDIG betingelse
 * i click-handleren — mens den reaktive knap-gate kom fra `evaluateErhvervsevnetabDownloadGates`,
 * der har stamdata-blokeringen indbygget (`erhvervsevnetabDownloadGate.ts:88-98`). De to udtryk
 * gav samme resultat, men var to formler. Definitionen bruger nu KUN
 * `evaluateErhvervsevnetabDownloadGates`, så reaktiv gate og preflight er samme kode.
 */
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../schemas/formSchemas';
import type { DocumentProjectionResult } from '../../document/definition/documentDefinition';
import { defineMineoDocument, type MineoDocumentDefinition } from '../../document/definition/mineoDocumentDefinition';
import { toGateReasons } from '../../document/definition/documentOutcome';
import type { DocumentSourceSettings } from '../../document/definition/documentSourceSettings';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';
import type { Koen } from '../../schemas/formSchemas/enumSchemas';
import type { EetDifferencekravComputation } from './eetDifferencekravCalculation';
import type { EetEalComputation } from './eetEalCalculation';
import type { EetKapitaliseringComputation } from './eetKapitaliseringCalculation';
import type { EetLoebendeComputation } from './eetLoebendeYdelserCalculation';
import {
  evaluateErhvervsevnetabDownloadGates,
  type EetDocumentFane,
  type ErhvervsevnetabDownloadGates,
} from './erhvervsevnetabDownloadGate';
import {
  buildErhvervsevnetabReaderProjection,
  type ErhvervsevnetabReaderProjection,
} from './erhvervsevnetabReaderProjection';

type SharedEetSource = Readonly<{
  projection: ErhvervsevnetabReaderProjection;
  gates: ErhvervsevnetabDownloadGates;
}>;

/** Builderen er selv memo-nøglen, så de fire faner deler ét slot pr. kildekontekst. */
const readSharedEetSource = (context: DocumentSourceContext<DocumentSourceSettings>): SharedEetSource => {
  const projection = buildErhvervsevnetabReaderProjection(context.evaluation.reader);
  return { projection, gates: evaluateErhvervsevnetabDownloadGates(projection) };
};

/**
 * Fælles dependency-/gate-evaluering for en EET-fane. `computation !== null` og
 * `documentStamdata.status === 'ready'` er allerede dækket af gaten (`no-result` henholdsvis
 * `eet:stamdata-field-error`); de gentages her som typeindsnævring, IKKE som en selvstændig gate.
 * Skulle gaten og snapshottet nogensinde divergere, fail-closer vi frem for at gætte.
 */
const projectEetFane = <TComputation, TInput>(
  context: DocumentSourceContext<DocumentSourceSettings>,
  fane: EetDocumentFane,
  readComputation: (projection: ErhvervsevnetabReaderProjection) => TComputation | null,
  toInput: (
    projection: ErhvervsevnetabReaderProjection,
    computation: TComputation,
    stamdata: StamdataValues
  ) => TInput
): DocumentProjectionResult<TInput> => {
  const { projection, gates } = context.shared(readSharedEetSource);
  const gate = gates[fane];
  if (!gate.canDownload) {
    return {
      status: 'blocked',
      reasons: toGateReasons(gate.reasons, {
        code: `eet-${fane}:blocked`,
        message: 'Dokumentet kan ikke hentes for den aktuelle sag',
      }),
    };
  }

  const computation = readComputation(projection);
  const stamdata = projection.documentStamdata;
  if (computation === null || stamdata.status !== 'ready') {
    return {
      status: 'blocked',
      reasons: [{ code: `eet-${fane}:no-result`, message: 'Beregning kan ikke dannes' }],
    };
  }

  return { status: 'ready', input: toInput(projection, computation, stamdata.value) };
};

// ---------------------------------------------------------------------------------------------
// loebende-ydelser
// ---------------------------------------------------------------------------------------------

export type LoebendeYdelserDocumentInput = Readonly<{
  computation: EetLoebendeComputation;
  visUdvidetSpecifikation: boolean;
  stamdata: StamdataValues;
}>;

export const loebendeYdelserDocumentDefinition: MineoDocumentDefinition<LoebendeYdelserDocumentInput> =
  defineMineoDocument({
    id: 'loebende-ydelser',
    brevhoved: { kind: 'settings-key', key: 'erhvervsevnetab' },
    labels: { documentName: 'løbende ydelser' },
    project: (context) => projectEetFane(
      context,
      'loebendeYdelser',
      (projection) => projection.snapshot.loebendeYdelser.computation,
      (projection, computation, stamdata) => ({
        computation,
        visUdvidetSpecifikation: projection.values.eetDifferencekravBilagSelection.visUdvidetSpecifikation,
        stamdata,
      })
    ),
    loadRenderer: async () => {
      const { generateLoebendeYdelserDocument } = await import(
        '../../document/generators/loebendeYdelser/loebendeYdelserDocument'
      );
      return (session, input, ctx) => generateLoebendeYdelserDocument(session, {
        computation: input.computation,
        visUdvidetSpecifikation: input.visUdvidetSpecifikation,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// kapitalisering
// ---------------------------------------------------------------------------------------------

export type KapitaliseringDocumentInput = Readonly<{
  computation: EetKapitaliseringComputation;
  koen: Koen | undefined;
  stamdata: StamdataValues;
}>;

export const kapitaliseringDocumentDefinition: MineoDocumentDefinition<KapitaliseringDocumentInput> =
  defineMineoDocument({
    id: 'kapitalisering',
    brevhoved: { kind: 'settings-key', key: 'erhvervsevnetab' },
    labels: { documentName: 'kapitalisering' },
    project: (context) => projectEetFane(
      context,
      'kapitalisering',
      (projection) => projection.snapshot.kapitalisering.computation,
      (projection, computation, stamdata) => ({
        computation,
        koen: projection.values.koen ?? undefined,
        stamdata,
      })
    ),
    loadRenderer: async () => {
      const { generateKapitaliseringDocument } = await import(
        '../../document/generators/kapitalisering/kapitaliseringDocument'
      );
      return (session, input, ctx) => generateKapitaliseringDocument(session, {
        computation: input.computation,
        koen: input.koen,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// efter-eal
// ---------------------------------------------------------------------------------------------

export type EfterEalDocumentInput = Readonly<{
  computation: EetEalComputation;
  stamdata: StamdataValues;
}>;

export const efterEalDocumentDefinition: MineoDocumentDefinition<EfterEalDocumentInput> =
  defineMineoDocument({
    id: 'efter-eal',
    brevhoved: { kind: 'settings-key', key: 'erhvervsevnetab' },
    labels: { documentName: 'EET efter EAL' },
    project: (context) => projectEetFane(
      context,
      'efterEal',
      (projection) => projection.snapshot.efterEal.computation,
      (_projection, computation, stamdata) => ({ computation, stamdata })
    ),
    loadRenderer: async () => {
      const { generateEfterEalDocument } = await import(
        '../../document/generators/eet/eetEfterEalDocument'
      );
      return (session, input, ctx) => generateEfterEalDocument(session, {
        computation: input.computation,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// differencekrav
// ---------------------------------------------------------------------------------------------

export type DifferencekravDocumentInput = Readonly<{
  computation: EetDifferencekravComputation;
  koen: Koen | undefined;
  /**
   * Sagens fulde bilagsvalg. Generatorens `BilagSelection` er et strukturelt SUBSET (den kender
   * ikke `visUdvidetSpecifikation`, som hører til løbende ydelser-outputtet), så projektionens
   * type er den rigtige her: definitionen må ikke smalne inputtet ned og dermed skjule, hvad
   * outputtet faktisk afhænger af.
   */
  bilagSelection: ErhvervsevnetabComposedValues['eetDifferencekravBilagSelection'];
  stamdata: StamdataValues;
}>;

export const differencekravDocumentDefinition: MineoDocumentDefinition<DifferencekravDocumentInput> =
  defineMineoDocument({
    id: 'differencekrav',
    brevhoved: { kind: 'settings-key', key: 'erhvervsevnetab' },
    labels: { documentName: 'differencekrav' },
    project: (context) => projectEetFane(
      context,
      'differencekrav',
      (projection) => projection.snapshot.differencekrav.computation,
      (projection, computation, stamdata) => ({
        computation,
        koen: projection.values.koen ?? undefined,
        bilagSelection: projection.values.eetDifferencekravBilagSelection,
        stamdata,
      })
    ),
    loadRenderer: async () => {
      const { generateDifferencekravDocument } = await import(
        '../../document/generators/differencekrav/differencekravDocument'
      );
      return (session, input, ctx) => generateDifferencekravDocument(session, {
        computation: input.computation,
        koen: input.koen,
        bilagSelection: input.bilagSelection,
        visBrevhoved: ctx.visBrevhoved,
        stamdata: input.stamdata,
      });
    },
  });
