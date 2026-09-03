import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { APP_ROUTES } from '../../../config/pageNavigation';
import { buildForsoergertabReaderProjection } from '../../../domain/forsoergertab/forsoergertabReaderProjection';
import { forsoergertabDocumentDefinition } from '../../../domain/forsoergertab/forsoergertabDocumentDefinition';
import { useMineoDocumentOutput } from '../../../document/runtime/react/useMineoDocumentOutput';
import {
  forsoergertabBeregningsdatoField,
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
  forsoergertabVirkningsdatoField,
} from '../../../inputCore/catalog/forsoergertabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../../inputCore/catalog/faellesAarsloenDescriptors';
import {
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
  stamdataSkadestypeField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { resolveStamdataDatoReference } from '../../../domain/policies/stamdataCalculations';
import type { FieldAddress } from '../../../inputCore/fieldAddress';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import type { AnyFieldRef } from '../../../inputCore/fieldDescriptor';
import { scrollToFieldAddress } from '../../../utils/scrollToFieldAddress';
import { useInputEvaluation } from '../../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../../inputCore/react/useFieldEditor';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';
import { dateRanges_forsoergertab } from '../../../config/dateRanges';
import { formatIsoDateLong } from '../../../utils/dateFormatting';
import { getTodayLocalISO } from '../../../utils/dateUtils';

/**
 * Forsørgertabs ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Hele siden kører på inputCore: de fem forsoergertab-felter + de delte ASL/EAL-årsløn skriver/læser gennem den
 * offentlige `InputReader` + den ene write-grænse, og de tværsektionelle stamdata-datoer læses gennem samme
 * reader. Den ENE reader-afledte projektion driver både beregningsvisning og download-gaten; den kører
 * `computeForsoergertabSnapshot` UÆNDRET (§5.4 – ingen talændring).
 *
 * Snapshottet ejer den dependency-specifikke panel-/gate-logik (§1.10) – det gates derfor ikke bag en global
 * blocked-tilstand: en fejl på fx virkningsdato blokerer ASL + download, men bevarer EAL-panelet.
 *
 * Format-/bounds-feltfejl vises inline på felterne fra det tokenbundne issue-snapshot; domæne-/manglende-felt-
 * beskeder vises i contentboxen og download-gatens tooltip (§1.7/§1.8).
 */

const efterladteFodselsdatoRef = forsoergertabEfterladteFodselsdatoField.bind();
const beregningsdatoRef = forsoergertabBeregningsdatoField.bind();
const virkningsdatoRef = forsoergertabVirkningsdatoField.bind();
const koenRef = forsoergertabKoenField.bind();
const tilkendtForPeriodeAarRef = forsoergertabTilkendtForPeriodeAarField.bind();
const aslAarsloenRef = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef = faellesAarsloenEalAarsloenField.bind();
const skadelidteFodselsdatoRef = stamdataSkadelidteFodselsdatoField.bind();
const skadedatoRef = stamdataSkadedatoField.bind();
const skadestypeRef = stamdataSkadestypeField.bind();

/**
 * route er eksplicit navigation-metadata (§3.7); Forsørgertab er en side uden faner (tabKey: null). De to
 * faellesAarsloen-lokationer (aslAarsloen/ealAarsloen) deler feltadresse med Erhvervsevnetab, men MED route
 * `/forsoergertab` – det er route (ikke feltadresse/section), der disambiguerer, hvilken side undo/redo lander på.
 */
const loc = (field: string): EditorLocation =>
  ({ locationId: `forsoergertab:${field}`, route: APP_ROUTES.forsoergertab, tabKey: null });

const BEREGNINGSDATO_LOCATION = loc('beregningsdato');

const FIELDS = Object.freeze({
  beregningsdato: beregningsdatoRef,
  virkningsdato: virkningsdatoRef,
  efterladteFodselsdato: efterladteFodselsdatoRef,
  koen: koenRef,
  tilkendtForPeriodeAar: tilkendtForPeriodeAarRef,
  aslAarsloen: aslAarsloenRef,
  ealAarsloen: ealAarsloenRef,
});

const LOCATIONS = Object.freeze({
  beregningsdato: BEREGNINGSDATO_LOCATION,
  virkningsdato: loc('virkningsdato'),
  efterladteFodselsdato: loc('efterladteFodselsdato'),
  koen: loc('koen'),
  tilkendtForPeriodeAar: loc('tilkendtForPeriodeAar'),
  aslAarsloen: loc('aslAarsloen'),
  ealAarsloen: loc('ealAarsloen'),
});

export function useForsoergertabViewModel() {
  const navigate = useNavigate();
  const evaluation = useInputEvaluation();

  const beregningsdatoController = useFieldEditor(beregningsdatoRef, BEREGNINGSDATO_LOCATION);

  const projection = React.useMemo(
    () => buildForsoergertabReaderProjection(evaluation.reader),
    [evaluation]
  );
  const { snapshot } = projection;

  // Hele download-livscyklussen ejes af definitionen (§A2); modellen aktiverer den blot.
  const download = useMineoDocumentOutput(forsoergertabDocumentDefinition, undefined);

  // Skadelidtes fødselsdato læses gennem readeren; en aktiv rød feltfejl skjuler værdien (`error`).
  const skadelidteFodselsdatoRead = evaluation.reader.read(skadelidteFodselsdatoRef);
  const skadelidteFodselsdato =
    skadelidteFodselsdatoRead.status === 'usable' ? skadelidteFodselsdatoRead.value : undefined;
  const skadelidteFodselsdatoError =
    skadelidteFodselsdatoRead.status === 'error' ? skadelidteFodselsdatoRead.issue.message : undefined;
  const skadedatoRead = evaluation.reader.read(skadedatoRef);
  const skadedato = skadedatoRead.status === 'usable' ? skadedatoRead.value : undefined;
  const skadedatoError = skadedatoRead.status === 'error' ? skadedatoRead.issue.message : undefined;
  const skadedatoLabel = evaluation.reader.labelOf(skadedatoRef);
  /**
   * Datoens navn i alle afledte tekster (BB-121). Rækken øverst hed korrekt «Anmeldelsesdato» ved en
   * erhvervssygdom, mens de tre EAL-tekster tolv linjer nede stadig sagde «skadestidspunktet»,
   * «skadesår» og «skadestidspunkt» om nøjagtig samme dato. Referencen bærer alle formerne, så de ikke
   * kan komme fra hinanden igen.
   */
  const skadestypeRead = evaluation.reader.read(skadestypeRef);
  const datoReference = resolveStamdataDatoReference(
    skadestypeRead.status === 'usable' ? skadestypeRead.value : undefined
  );

  /**
   * «Mangler (angiv i Stamdata)»-linket: naviger OG peg på det felt, der mangler.
   *
   * Linket navigerede tidligere kun til siden og efterlod brugeren dér uden anvisning – selv om det er den
   * reneste form for «en indtastning mangler»: feltet FINDES, det er blot tomt, og dets descriptor er
   * allerede bundet her. Markeringen er den delte `blinkFieldAttention` via `scrollToFieldAddress`, altså
   * samme adfærd som fejl- og advarselslinkene; ingen parallel vej.
   */
  const goToStamdataField = React.useCallback(
    (address: FieldAddress) => {
      navigate(APP_ROUTES.stamdata);
      scrollToFieldAddress(address);
    },
    [navigate]
  );
  const goToSkadelidteFodselsdato = React.useCallback(
    () => goToStamdataField(skadelidteFodselsdatoRef.address),
    [goToStamdataField]
  );
  const goToSkadedato = React.useCallback(
    () => goToStamdataField(skadedatoRef.address),
    [goToStamdataField]
  );

  /**
   * Feltets beregningsafvisende domæneregel som `crossFieldIssue`-prop, eller `{}` når feltet ikke har en
   * (BB-117).
   *
   * Spredningsformen `{...vm.domainIssueProps(felt)}` er valgt frem for en altid-tilstedeværende prop med
   * `undefined`, fordi `exactOptionalPropertyTypes` ellers ville afvise den – samme form som de øvrige
   * valgfri issue-props i programmet.
   */
  const domainIssueProps = React.useCallback(
    (field: { address: FieldAddress } | AnyFieldRef) => {
      const issue = snapshot.domainFieldIssues.get(serializeFieldAddress(field.address));
      return issue === undefined ? {} : { crossFieldIssue: issue };
    },
    [snapshot]
  );

  const settleBeregningsdato = React.useCallback(
    (today: Parameters<typeof beregningsdatoController.settleValue>[0]) => {
      beregningsdatoController.settleValue(today);
    },
    [beregningsdatoController]
  );

  // "Indsæt dags dato" må ikke kunne producere en værdi, feltet selv afviser (samme fejlklasse som
  // Varige méns BB-068): er dags dato uden for beregningsdatoens øvre grænse (forsørgertab-
  // satsdatasættets sidste dækkede år), er knappen inaktiv med årsagen i tooltippen.
  const beregningsdatoMax = dateRanges_forsoergertab.beregningsdato.max;
  const todayIso = React.useMemo(() => getTodayLocalISO(), []);
  const insertTodayDisabledReason = todayIso > beregningsdatoMax
    ? `Der kan kun foretages beregninger frem til ${formatIsoDateLong(beregningsdatoMax)}`
    : undefined;

  return {
    fields: FIELDS,
    locations: LOCATIONS,
    domainIssueProps,
    settleBeregningsdato,
    insertTodayDisabledReason,
    /**
     * Handlet gives ubearbejdet videre. UdfaldsBESKEDEN udledes i den sektion, der AKTIVERER downloaden –
     * ikke her: `document/activation-shows-outcome` måler pr. fil, at den flade, der klikker, også kan vise
     * udfaldet. Udledtes beskeden her, ville aktiveringen strukturelt være adskilt fra sin visning, og
     * ellers sammenblandes et forventeligt gate-afslag med en systemfejl.
     */
    download,
    skadelidteFodselsdato,
    skadelidteFodselsdatoError,
    skadedato,
    skadedatoError,
    skadedatoLabel,
    datoReference,
    goToSkadelidteFodselsdato,
    goToSkadedato,
    // Snapshot-afledt visning og panel-gates (§1.10).
    result: snapshot.calculation.result,
    ealComputation: snapshot.calculation.ealComputation,
    aslComputation: snapshot.calculation.aslComputation,
    foersoergertabEalMinSatsOre: snapshot.calculation.foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin: snapshot.calculation.foersoergertabForhoejtetTilMin,
    visKoenValg: snapshot.visKoenValg,
    canShowEal: snapshot.canShowEal,
    canShowAsl: snapshot.canShowAsl,
    canShowResult: snapshot.canShowResult,
    koenFieldHasError: snapshot.koenFieldHasError,
    ealAarsloenNotice: snapshot.ealAarsloenNotice,
  };
}
