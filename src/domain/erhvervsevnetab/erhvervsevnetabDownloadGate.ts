/**
 * Rene, per-fane download-gate-beslutninger for Erhvervsevnetab-siden.
 *
 * Gaten (§3.4/§5.4/§1.10): gaten afledes af den ENE reader-projektion
 * (`buildErhvervsevnetabReaderProjection`), som sidevisningen allerede afspejler. I modsætning til de øvrige
 * slices har EET FIRE uafhængige dokumenter (løbende ydelser, kapitalisering, EET efter EAL, differencekrav),
 * hver med sin egen dependency-specifikke blokering (§1.10). Snapshottets per-fane-projektion bærer
 * blokeringen. Gaten oversætter per-fane-tilstanden til ét `DocumentDownloadGateResult`, så en
 * downloadknap kan deaktiveres med en konkret dansk grund.
 *
 * Sandhedstabellen pr. fane (uændret fra `!hasBlockingErrors && computation` i tabsene):
 *
 *  - fanen blokeret af mindst ét RØDT feltfejl-issue (format/bounds/rule via readerens `fieldErrors`)
 *      → `field-error`, kind `invalid-input` ("Fejl i indtastning"),
 *  - fanen blokeret KUN af manglende/afledte consumer-fejl (`*-missing` m.fl.)
 *      → `missing-fields`, kind `missing-input` ("Indtastning mangler"),
 *  - fanen `ready`, men uden beregningsresultat (`computation === null`)
 *      → `no-result`, kind `missing-input` ("Beregning kan ikke dannes"),
 *  - ellers download tilladt.
 *
 * De to `Beregning kan ikke dannes`-grene bruger `blockDocumentDownloadForUnavailableCalculation`: input er
 * komplet og gyldigt, men beregningen kan ikke dannes. Klassen er fortsat `missing-input` (brugerens
 * praktiske handling ER at udfylde mere), men valget er nu eksplicit frem for en default, en fremtidig
 * gren kunne falde i.
 *
 * En rød feltfejl har forrang over en manglende-felt-fejl (samme prioritet som Varige mén-/Forsørgertab-gaten
 * og som EetIssuesBox' visning). Klassifikationen field vs missing ejes af `isEetFieldErrorIssueId`, så den ikke
 * driftes fra snapshottets/UI'ens egen forståelse.
 *
 * Funktionerne er uden React, så sandhedstabellen kan unit-testes direkte og ikke afhænger af monterede felter.
 */

import {
  allowDocumentDownload,
  blockDocumentDownload,
  blockDocumentDownloadForInvalidInput,
  blockDocumentDownloadForUnavailableCalculation,
  blockDocumentDownloadFromCauses,
  toBlockingCauses,
  type DocumentDownloadGateResult,
} from '../../document/layout/documentGateTypes';
import type { EetSnapshot } from './eetSnapshot';
import { isEetFieldErrorIssueId } from './eetFormatUtils';
import type { ErhvervsevnetabReaderProjection } from './erhvervsevnetabReaderProjection';

/** De fire selvstændige EET-dokumentfaner, hver med sin egen §1.10-blokering. */
export type EetDocumentFane = 'loebendeYdelser' | 'kapitalisering' | 'efterEal' | 'differencekrav';

/** Én fane-projektions gate-relevante form: dens (blokerende) issues og om et beregningsresultat findes. */
type EetFaneProjection = EetSnapshot[EetDocumentFane];

const GATE_CODE_PREFIX: Record<EetDocumentFane, string> = {
  loebendeYdelser: 'eet-loebende-ydelser',
  kapitalisering: 'eet-kapitalisering',
  efterEal: 'eet-efter-eal',
  differencekrav: 'eet-differencekrav',
};

/**
 * Afleder gate-resultatet for én EET-fane fra dens snapshot-projektion. En rød feltfejl vinder over en
 * manglende-felt-fejl; et manglende beregningsresultat (`computation === null`) uden blokerende fejl er
 * `no-result`.
 */
export const evaluateEetFaneDownloadGate = (
  fane: EetDocumentFane,
  projection: EetFaneProjection
): DocumentDownloadGateResult => {
  const codePrefix = GATE_CODE_PREFIX[fane];
  if (projection.hasBlockingErrors) {
    if (projection.issues.some((issue) => issue.id === 'runtime-exception')) {
      // En intern beregningsundtagelse: intet mangler og intet er rødt (§1.1).
      return blockDocumentDownloadForUnavailableCalculation({ code: `${codePrefix}:internal-error`, message: 'Beregning kan ikke dannes' });
    }
    const hasFieldError = projection.issues.some(
      (issue) => issue.severity === 'error' && isEetFieldErrorIssueId(issue.id)
    );
    if (hasFieldError) {
      return blockDocumentDownloadForInvalidInput({ code: `${codePrefix}:field-error`, message: 'Fejl i indtastning' });
    }
    return blockDocumentDownload({ code: `${codePrefix}:missing-fields`, message: 'Indtastning mangler' });
  }
  if (projection.computation === null) {
    return blockDocumentDownloadForUnavailableCalculation({ code: `${codePrefix}:no-result`, message: 'Beregning kan ikke dannes' });
  }
  return allowDocumentDownload();
};

/** Gate-resultatet for hver af de fire EET-dokumentfaner, afledt af den ENE reader-projektion. */
export type ErhvervsevnetabDownloadGates = Readonly<Record<EetDocumentFane, DocumentDownloadGateResult>>;

/**
 * Bygger gate-beslutningen for alle fire EET-dokumentfaner ud fra reader-projektionens snapshot. Hver fane
 * gates uafhængigt (§1.10), så en fejl i fx EAL-delen aldrig blokerer løbende ydelser-/kapitaliserings-
 * downloaden.
 */
export const evaluateErhvervsevnetabDownloadGates = (
  projection: ErhvervsevnetabReaderProjection
): ErhvervsevnetabDownloadGates => {
  const { snapshot } = projection;
  if (projection.documentStamdata.status === 'blocked') {
    // Brevhoved-stamdata kan kun blokere på en RØD feltfejl (kun `optional`-reads), så klassen var
    // korrekt – men hardkodet, og kunne derfor ikke citere en enkeltstående bounds-/rule-grænse.
    const stamdataGate = blockDocumentDownloadFromCauses(
      'eet:stamdata-field-error',
      toBlockingCauses(projection.documentStamdata.issues),
      'Fejl i indtastning'
    );
    return {
      loebendeYdelser: stamdataGate,
      kapitalisering: stamdataGate,
      efterEal: stamdataGate,
      differencekrav: stamdataGate,
    };
  }
  return {
    loebendeYdelser: evaluateEetFaneDownloadGate('loebendeYdelser', snapshot.loebendeYdelser),
    kapitalisering: evaluateEetFaneDownloadGate('kapitalisering', snapshot.kapitalisering),
    efterEal: evaluateEetFaneDownloadGate('efterEal', snapshot.efterEal),
    differencekrav: evaluateEetFaneDownloadGate('differencekrav', snapshot.differencekrav),
  };
};
