/**
 * De fire EO-dokumentdefinitioner.
 *
 * Definitionerne GENBRUGER den eksisterende reader-projektion og gate uændret (§5.4): de flytter
 * kun ejerskabet af rækkefølgen fra `useEoBeregningViewModel` ind i kataloget. Bilag-selektionen,
 * `midlertidigtEetGroups` og de fire per-dokument-projektioner er nu en del af definitionens
 * `project`, så det, der før var view-model-lokale `resolveFreshBilag`/`prepareFreshDownload`,
 * er blevet dependencies på outputtet.
 *
 * Alle fire deler ÉN projektion og ÉT gate-sæt gennem `context.shared`, så den dyre
 * `collectAllEoRows`-aggregering kører én gang pr. kildekontekst – ikke fire.
 */
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../schemas/formSchemas';
import type { DocumentProjectionResult } from '../../document/definition/documentDefinition';
import {
  defineMineoDocument,
  type MineoDocumentDefinition,
  type MineoDocumentGateSettings,
} from '../../document/definition/mineoDocumentDefinition';
import {
  blockedProjectionWithSpecificReason,
  toGateReasons,
} from '../../document/definition/documentOutcome';
import type { DocumentSourceContext } from '../../document/definition/documentSourceContext';

import type { DocumentDownloadGateResult } from '../../document/layout/documentGateTypes';
import { buildMidlertidigtEetInsertSource } from '../erhvervsevnetab/eetImportPort';
import type { SelectedElements } from '../../document/generators/eo/types';
import type { MidlertidigtEetAfgoerelseGroup } from './helpers/midlertidigtEetInsertRows';
import {
  EO_BILAG_DYNAMIC_SELECTION_KEYS,
  getEoBilagAvailability,
} from './helpers/eoBilagRules';
import {
  evaluateErstatningsopgoerelseDownloadGates,
  type EoDocumentKey,
  type ErstatningsopgoerelseDownloadGates,
} from './erstatningsopgoerelseDownloadGate';
import {
  buildErstatningsopgoerelseReaderProjection,
  type ErstatningsopgoerelseReaderProjection,
} from './erstatningsopgoerelseReaderProjection';
import { eoSnapshotToEoDocument } from './snapshot/eoSnapshotToEoDocument';
import type { EoModel } from './shared/eoTypes';
import {
  eoSnapshotToTafPerYearDocument,
  type TafPerYearDocument,
} from './snapshot/eoSnapshotToTafPerYearDocument';
import {
  eoSnapshotToTafPerYearOpreguleretDocument,
  type TafPerYearOpreguleretDocument,
} from './snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import {
  eoSnapshotToTafKravGrafDocument,
  type TafKravGrafDocument,
} from './snapshot/eoSnapshotToTafKravGrafDocument';

/** Standard-bilagsvalg, når sagen ikke selv har gemt et. Uændret fra view-modellen. */
const DEFAULT_EO_BILAG_SELECTION: SelectedElements = {
  opgoerelse: true,
  loenindkomst: true,
  offentligeYdelser: true,
  midlertidigEet: true,
  shDage: false,
  regulering: true,
  okSatser: true,
  sygeferiegodtgoerelse: true,
};

/**
 * Den fælles EO-kildeprojektion + gate-sættet. Nøglen er funktionen selv, så alle fire
 * definitioner rammer samme memo-slot i den samme kildekontekst.
 */
type SharedEoSource = Readonly<{
  projection: ErstatningsopgoerelseReaderProjection;
  gates: ErstatningsopgoerelseDownloadGates;
}>;

/**
 * Builderen er selv memo-nøglen, så alle fire definitioner rammer samme slot i samme kildekontekst,
 * og nøgle/resultattype ikke kan komme fra hinanden.
 */
const readSharedEoSource = (context: DocumentSourceContext<MineoDocumentGateSettings>): SharedEoSource => {
  const projection = buildErstatningsopgoerelseReaderProjection(context.evaluation.reader, {
    midlertidigtEetInsertSource: buildMidlertidigtEetInsertSource(context.evaluation),
  });
  return {
    // Gate-settings ER rækkepolitikken: konteksten bar før hele `SourceSettings`, og
    // projektionen skulle derfor selv skære den ned. Nu leverer miljøet præcis den halvdel, gaten må
    // se, og indsnævringen sker ét sted – i `captureSource` – frem for i hver definition.
    projection,
    gates: evaluateErstatningsopgoerelseDownloadGates(projection, context.settings),
  };
};

/**
 * Bilagsvalget, som det gælder for det FRISKE snapshot: sagens gemte valg, hvor hvert dynamisk
 * bilag slås fra, hvis det ikke er tilgængeligt i den aktuelle beregning. Var før `resolveFreshBilag`
 * i view-modellen; er nu en dependency på de to outputs, der har bilag.
 */
const resolveBilagSelection = (projection: ErstatningsopgoerelseReaderProjection): SelectedElements => {
  const availability = getEoBilagAvailability({
    eoValues: projection.eoValues,
    skadedatoISO: projection.stamdataValues.skadedato,
    loenudvikling: projection.snapshot.data?.pdfModel.tabtArbejdsfortjeneste.loenudvikling,
    offentligeYdelserUdvikling: projection.snapshot.data?.pdfModel.tabtArbejdsfortjeneste.offentligeYdelserUdvikling,
  });
  const selection: SelectedElements = { ...(projection.eoValues.eoBilagSelection ?? DEFAULT_EO_BILAG_SELECTION) };
  for (const key of EO_BILAG_DYNAMIC_SELECTION_KEYS) {
    if (!availability[key].enabled) selection[key] = false;
  }
  // Opgørelsen er ikke et valg: fladen viser den låst til (`lockedOn`), og generatoren kaster, hvis den
  // mangler. En sag gemt før låsningen – eller en håndredigeret .eo-fil – kan bære `opgoerelse: false`,
  // og uden dette ville et felt, brugeren ikke kan røre, blokere dokumentet. Låsningen gælder derfor
  // begge veje: visningen OG kilden.
  selection.opgoerelse = true;
  return selection;
};

/**
 * Test-adgang til bilagsvalget. Reglen «opgørelsen er altid valgt» er en invariant mellem fladen og
 * generatoren, og den skal kunne prøves direkte – ikke kun gennem en fuld dokumentkørsel.
 */
export const __testResolveBilagSelection = resolveBilagSelection;

const resolveMidlertidigtEetGroups = (
  projection: ErstatningsopgoerelseReaderProjection
): readonly MidlertidigtEetAfgoerelseGroup[] =>
  projection.eoValues.midlertidigtEetFraEetSiden === 'Ja'
    ? (projection.snapshot.data?.midlertidigtEetGroups ?? [])
    : [];

/**
 * Fælles blokeringsoversættelse for de fire EO-outputs. `gate` dækker række-/invariantniveauet,
 * mens per-dokument-projektionen dækker snapshot-invariant-/fail_closed-niveauet. Begge lag er
 * nødvendige og samlet her.
 */
const blockedFromGate = <T>(gate: DocumentDownloadGateResult): DocumentProjectionResult<T> => ({
  status: 'blocked',
  reasons: toGateReasons(gate.reasons, {
    code: 'eo.blocked',
    message: 'Dokumentet kan ikke hentes for den aktuelle sag',
  }),
});

/**
 * EO-projektionens egen blokering. Beskeden er `specific`: den kommer fra dokumentprojektionen og
 * navngiver den konkrete række/det konkrete felt, der skal rettes – samme familie som `eoDocumentDownloadGate`s
 * årsag, og lige så værd at citere ordret.
 */
const blockedFromProjection = blockedProjectionWithSpecificReason;

/**
 * Den fælles indgang for de fire outputs: hent delt kilde, tjek dokumentets eget gate, og kør
 * dokumentets egen projektion. Rækkefølgen er identisk med den, view-modellen og servicegrænsen
 * havde tilsammen.
 */
const projectEoDocument = <TDocument, TInput>(
  context: DocumentSourceContext<MineoDocumentGateSettings>,
  gateKey: EoDocumentKey,
  toDocument: (projection: ErstatningsopgoerelseReaderProjection) =>
    | Readonly<{ kind: 'ok'; document: TDocument }>
    | Readonly<{ kind: 'blocked'; message: string }>,
  toInput: (projection: ErstatningsopgoerelseReaderProjection, document: TDocument) => TInput
): DocumentProjectionResult<TInput> => {
  const { projection, gates } = context.shared(readSharedEoSource);
  const gate = gates[gateKey];
  if (!gate.canDownload) return blockedFromGate(gate);

  const document = toDocument(projection);
  if (document.kind === 'blocked') {
    return blockedFromProjection(`eo.${gateKey}.projection-blocked`, document.message);
  }

  return { status: 'ready', input: toInput(projection, document.document) };
};

// ---------------------------------------------------------------------------------------------
// erstatningsopgoerelse
// ---------------------------------------------------------------------------------------------

export type ErstatningsopgoerelseDocumentInput = Readonly<{
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  document: EoModel;
  midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[];
}>;

export const erstatningsopgoerelseDocumentDefinition: MineoDocumentDefinition<ErstatningsopgoerelseDocumentInput> =
  defineMineoDocument({
    id: 'erstatningsopgoerelse',
    brevhoved: { kind: 'settings-key', key: 'erstatningsopgoerelse' },
    labels: { documentName: 'erstatningsopgørelse' },
    project: (context) => projectEoDocument(
      context,
      'erstatningsopgoerelse',
      (projection) => eoSnapshotToEoDocument(projection.snapshot),
      (projection, document) => ({
        stamdataValues: projection.stamdataValues,
        eoValues: projection.eoValues,
        selectedElements: resolveBilagSelection(projection),
        document,
        midlertidigtEetGroups: resolveMidlertidigtEetGroups(projection),
      })
    ),
    loadRenderer: async () => {
      const { generateErstatningsopgoerelseDocument } = await import(
        '../../document/generators/eo/erstatningsopgoerelseDocument'
      );
      return (session, input, ctx) => generateErstatningsopgoerelseDocument(
        session,
        input.stamdataValues,
        input.eoValues,
        input.selectedElements,
        {
          visBrevhoved: ctx.visBrevhoved,
          erstatningsopgoerelseAfsluttesMed: input.eoValues.erstatningsopgoerelseAfsluttesMed,
          visUdkastStempel: input.eoValues.indsaetUdkastStempel === 'Ja',
          document: input.document,
          midlertidigtEetGroups: input.midlertidigtEetGroups,
        }
      );
    },
  });

// ---------------------------------------------------------------------------------------------
// taf-fordelt-paa-aar
// ---------------------------------------------------------------------------------------------

export type TafFordeltPaaAarDocumentInput = Readonly<{
  document: TafPerYearDocument;
  visUdkastStempel: boolean;
}>;

export const tafFordeltPaaAarDocumentDefinition: MineoDocumentDefinition<TafFordeltPaaAarDocumentInput> =
  defineMineoDocument({
    id: 'taf-fordelt-paa-aar',
    brevhoved: { kind: 'settings-key', key: 'erstatningsopgoerelse' },
    labels: { documentName: 'TAF fordelt på år' },
    project: (context) => projectEoDocument(
      context,
      'tafFordeltPaaAar',
      (projection) => eoSnapshotToTafPerYearDocument(projection.snapshot),
      (projection, document) => ({
        document,
        visUdkastStempel: projection.eoValues.indsaetUdkastStempel === 'Ja',
      })
    ),
    loadRenderer: async () => {
      const { generateTafFordeltPaaAarDocument } = await import(
        '../../document/generators/tafFordelt/tafFordeltPaaAarDocument'
      );
      return (session, input, ctx) => generateTafFordeltPaaAarDocument(session, {
        visBrevhoved: ctx.visBrevhoved,
        visUdkastStempel: input.visUdkastStempel,
        document: input.document,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// taf-opreguleret-paa-aar
// ---------------------------------------------------------------------------------------------

export type TafOpreguleretPaaAarDocumentInput = Readonly<{
  document: TafPerYearOpreguleretDocument;
  stamdataValues: StamdataValues;
  eoValues: ErstatningsopgoerelseValues;
  selectedElements: SelectedElements;
  midlertidigtEetGroups: readonly MidlertidigtEetAfgoerelseGroup[];
}>;

export const tafOpreguleretPaaAarDocumentDefinition: MineoDocumentDefinition<TafOpreguleretPaaAarDocumentInput> =
  defineMineoDocument({
    id: 'taf-opreguleret-paa-aar',
    brevhoved: { kind: 'settings-key', key: 'erstatningsopgoerelse' },
    labels: { documentName: 'TAF opreguleret til beregningsår' },
    project: (context) => projectEoDocument(
      context,
      'tafOpreguleret',
      (projection) => eoSnapshotToTafPerYearOpreguleretDocument(projection.snapshot),
      (projection, document) => ({
        document,
        stamdataValues: projection.stamdataValues,
        eoValues: projection.eoValues,
        selectedElements: resolveBilagSelection(projection),
        midlertidigtEetGroups: resolveMidlertidigtEetGroups(projection),
      })
    ),
    loadRenderer: async () => {
      const { generateTafOpreguleretPaaAarDocument } = await import(
        '../../document/generators/tafFordelt/tafOpreguleretPaaAarDocument'
      );
      return (session, input, ctx) => generateTafOpreguleretPaaAarDocument(session, {
        visBrevhoved: ctx.visBrevhoved,
        visUdkastStempel: input.eoValues.indsaetUdkastStempel === 'Ja',
        document: input.document,
        eoValues: input.eoValues,
        stamdataValues: input.stamdataValues,
        selectedElements: input.selectedElements,
        midlertidigtEetGroups: input.midlertidigtEetGroups,
      });
    },
  });

// ---------------------------------------------------------------------------------------------
// taf-krav-graf
// ---------------------------------------------------------------------------------------------

export type TafKravGrafDocumentInput = Readonly<{
  document: TafKravGrafDocument;
  visUdkastStempel: boolean;
}>;

export const tafKravGrafDocumentDefinition: MineoDocumentDefinition<TafKravGrafDocumentInput> =
  defineMineoDocument({
    id: 'taf-krav-graf',
    brevhoved: { kind: 'settings-key', key: 'erstatningsopgoerelse' },
    labels: { documentName: 'visuel graf over indtægtsniveau' },
    project: (context) => projectEoDocument(
      context,
      'tafKravGraf',
      (projection) => eoSnapshotToTafKravGrafDocument(projection.snapshot),
      (projection, document) => ({
        document,
        visUdkastStempel: projection.eoValues.indsaetUdkastStempel === 'Ja',
      })
    ),
    loadRenderer: async () => {
      const { generateTafKravGrafDocument } = await import(
        '../../document/generators/tafFordelt/tafKravGrafDocument'
      );
      return (session, input, ctx) => generateTafKravGrafDocument(session, {
        visBrevhoved: ctx.visBrevhoved,
        visUdkastStempel: input.visUdkastStempel,
        document: input.document,
      });
    },
  });
