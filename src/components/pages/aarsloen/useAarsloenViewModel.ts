import * as React from 'react';

import { APP_ROUTES } from '../../../config/pageNavigation';
import { useInputEvaluation } from '../../../inputCore/react/useInputEvaluation';
import { useOmregningToggle } from '../../../hooks/useOmregningToggle';
import {
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
} from '../../../domain/aarsloen/aarsloenDocumentDefinitions';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../../document/runtime/react/useMineoDocumentOutput';
import {
  aarsloenAntalFeriedageField,
  aarsloenFeriePctField,
  aarsloenFritvalgPctField,
  aarsloenFuldLoenUnderFerieField,
  aarsloenLoenPaaHelligdageField,
  aarsloenLoenperiodeField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenPensionPctField,
  aarsloenRetTilSjetteFerieugeField,
  aarsloenShSoPctField,
  aarsloenStoreBededagPctField,
  aarsloenTillaegAngivesSomField,
} from '../../../inputCore/catalog/aarsloenDescriptors';
import { buildAarsloenReaderProjection } from '../../../domain/aarsloen/aarsloenProjection';
import { AARSLOEN_BEREGNING_INGEN } from '../../../types/calculation';
import type { FieldRef } from '../../../inputCore/fieldDescriptor';
import type { EditorLocation } from '../../../inputCore/editor/fieldEditorState';
import { resolveAarsloenIndtastetEnhedSummary } from '../../../domain/aarsloen/aarsloenPeriodDisplay';
import {
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../../domain/policies/aarsloenPolicy';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../../../types/handles';
import type { LoenPaaHelligdage, TillaegAngivesSom } from '../../../schemas/formSchemas/enumSchemas';
import { firstPageMessage, pageMessage, withPageMessages } from '../../layout/pageMessage';

/**
 * Årslønsberegnings ene kanoniske viewmodel (`page-component-contract.md` §4.4).
 *
 * Hele siden kører på inputCore: Satser-blokken, løntabellen (`StandardLoenTable` over grid-adapteren) OG
 * beregningsprincip-blokken skriver/læser gennem den offentlige `InputReader` + den ene write-grænse. Alle
 * `values` til calc/render læses via reader-projektionen, og løntabellens valideringssummary er reader-afledt, så
 * omregning-gaten og dokumentgaten deler præcis samme sandhed som cellernes røde issues.
 *
 * Modellen orkestrerer — den genberegner ikke: beregningskernen ligger i `buildAarsloenReaderProjection`.
 */

// Stabile felt-refs + editorlokationer (§3.2): locationId er editor-metadata, ikke dataidentitet.
const feriePctRef = aarsloenFeriePctField.bind();
const fritvalgPctRef = aarsloenFritvalgPctField.bind();
const shSoPctRef = aarsloenShSoPctField.bind();
const storeBededagPctRef = aarsloenStoreBededagPctField.bind();
const pensionPctRef = aarsloenPensionPctField.bind();
const loenperiodeRef = aarsloenLoenperiodeField.bind();
// Påkrævet valg (allowEmpty=false): descriptorens værditype er ikke-optionel, men Choice-/radio-skallen
// er typet på `TValue | undefined`. Værdien er altid defineret (tomværdi 'procent'/'maaned'); widening er sikker.
const tillaegAngivesSomRef = aarsloenTillaegAngivesSomField.bind() as FieldRef<TillaegAngivesSom | undefined>;
const loenPaaHelligdageRef = aarsloenLoenPaaHelligdageField.bind() as FieldRef<LoenPaaHelligdage | undefined>;
const fuldLoenUnderFerieRef = aarsloenFuldLoenUnderFerieField.bind();
const retTilSjetteFerieugeRef = aarsloenRetTilSjetteFerieugeField.bind();
const antalFeriedageRef = aarsloenAntalFeriedageField.bind();
const omregningTilFuldtAarRef = aarsloenOmregningTilFuldtAarField.bind();

// route er eksplicit navigation-metadata (§3.7); Årsløn er en side uden faner (tabKey: null).
const loc = (field: string): EditorLocation =>
  ({ locationId: `aarsloen:${field}`, route: APP_ROUTES.aarsloen, tabKey: null });

const FIELDS = Object.freeze({
  feriePct: feriePctRef,
  fritvalgPct: fritvalgPctRef,
  shSoPct: shSoPctRef,
  storeBededagPct: storeBededagPctRef,
  pensionPct: pensionPctRef,
  loenperiode: loenperiodeRef,
  tillaegAngivesSom: tillaegAngivesSomRef,
  loenPaaHelligdage: loenPaaHelligdageRef,
  fuldLoenUnderFerie: fuldLoenUnderFerieRef,
  retTilSjetteFerieuge: retTilSjetteFerieugeRef,
  antalFeriedage: antalFeriedageRef,
  omregningTilFuldtAar: omregningTilFuldtAarRef,
});

const LOCATIONS = Object.freeze({
  feriePct: loc('feriePct'),
  fritvalgPct: loc('fritvalgPct'),
  shSoPct: loc('shSoPct'),
  storeBededagPct: loc('storeBededagPct'),
  pensionPct: loc('pensionPct'),
  loenperiode: loc('loenperiode'),
  tillaegAngivesSom: loc('tillaegAngivesSom'),
  loenPaaHelligdage: loc('loenPaaHelligdage'),
  fuldLoenUnderFerie: loc('fuldLoenUnderFerie'),
  retTilSjetteFerieuge: loc('retTilSjetteFerieuge'),
  antalFeriedage: loc('antalFeriedage'),
  omregningTilFuldtAar: loc('omregningTilFuldtAar'),
});

/** Løntabellens navigationslokation — tabellen bygger selv sine celle-lokationer af den. */
const TABLE_LOCATION_NAV = Object.freeze({ route: APP_ROUTES.aarsloen, tabKey: null });

const DOWNLOAD_SHAKE_MS = 500;

export function useAarsloenViewModel() {
  const evaluation = useInputEvaluation();

  const readerProjection = React.useMemo(
    () => buildAarsloenReaderProjection(evaluation.reader),
    [evaluation]
  );
  const { values, tableValidation, omregningGate } = readerProjection;

  const tabelRef = React.useRef<StandardLoenTableHandle | null>(null);

  // Omregning-toggle: den persisterede canonical værdi + den centrale gate. Toggle-visning og skjult indhold
  // reagerer på samme committed forudsætninger (gate). Togglen er et ALMINDELIGT persisteret felt gennem
  // `ToggleField` (§3.2/§3.7) — gaten leveres som dens `commit`-override, så en ugyldig aktivering afvises uden
  // at feltbindingen eller undo/redo-fokusmetadataen falder væk.
  const toggleRef = React.useRef<StyledToggleSwitchHandle | null>(null);

  const {
    checked: omregningChecked,
    effectiveEnabled: omregningAktiveret,
    decideToggle: decideOmregningToggle,
  } = useOmregningToggle({ gate: omregningGate, tabelRef, toggleRef });

  // Fatal-gate (§1.6/§3.9): et satsinput uden for 0–100 (eller antalFeriedage uden for 0–99) er en RØD
  // feltfejl. Projektionen kalder da IKKE motoren (`calculation === null`), så der findes intet resultat at
  // vise — en beregning på den skjulte tomværdi ville være misvisende.
  const { calculation } = readerProjection;
  const harFatalBeregningsFejl = calculation === null || calculation.harFatalBeregningsFejl;

  // Beregningsfelterne læses kun når der ER et resultat; ellers viser siden '—' (harFatalBeregningsFejl).
  const periodeData = calculation?.periodeData ?? null;
  const shDageAntal = calculation?.shDageAntal ?? null;
  const beregnetAarsloen = calculation?.beregnetAarsloen ?? 0;
  // `metode: 'ingen'` er modellens kanoniske "ingen beregning" — samme variant motoren selv returnerer, når
  // input ikke rækker til en metode. Ingen opdigtede tal.
  const beregningsData = calculation?.beregningsData ?? AARSLOEN_BEREGNING_INGEN;
  const fejlmeddelelser = calculation?.fejlmeddelelser ?? [];
  // Den kritiske beregningsfejl som `PageMessage`, ikke som rå streng: boksen må ikke kunne vises uden indhold.
  // Her stod tidligere `?? []` på et `string | null`-felt — et tomt array er truthy, så "Kritisk Fejl"-boksen
  // stod permanent øverst på siden UDEN tekst. `pageMessage()` normaliserer null/tom/whitespace til ÉN
  // fraværs-variant, og `PageMessageBox` ejer værnet. Se `components/layout/pageMessage.ts` for fejlklassen.
  const beregningsFejl = pageMessage(calculation?.beregningsFejl);

  // Dokument-download. Begge outputs deler ÉN kildekontekst, så årsløns-projektionen kun bygges én gang pr.
  // revision, uanset at siden tegner to knapper. Hele preflighten — settle, frisk capture, token-lighed, gate —
  // ejes af definitionerne; her er kun blokerings-FEEDBACKEN tilbage (shake + flash af den fejlende celle).
  const documentContext = useMineoDocumentSourceContext();
  const aarsloenDownload = useMineoDocumentOutputWithContext(aarsloenDocumentDefinition, undefined, documentContext);
  const shDageDownload = useMineoDocumentOutputWithContext(shDageDocumentDefinition, undefined, documentContext);

  const [downloadShake, setDownloadShake] = React.useState(false);
  const downloadShakeTimeoutRef = React.useRef<number | null>(null);
  React.useEffect(() => () => {
    if (downloadShakeTimeoutRef.current !== null) window.clearTimeout(downloadShakeTimeoutRef.current);
  }, []);
  const triggerDownloadShake = React.useCallback(() => {
    setDownloadShake(true);
    if (downloadShakeTimeoutRef.current !== null) window.clearTimeout(downloadShakeTimeoutRef.current);
    downloadShakeTimeoutRef.current = window.setTimeout(() => {
      setDownloadShake(false);
      downloadShakeTimeoutRef.current = null;
    }, DOWNLOAD_SHAKE_MS);
  }, []);

  const runAarsloenDownload = React.useCallback(async () => {
    const outcome = await aarsloenDownload.download(undefined);
    if (outcome.status === 'rejected' && outcome.rejection.kind === 'gate-blocked') {
      triggerDownloadShake();
      const firstError = tableValidation.errors[0];
      if (firstError?.kind === 'cell') tabelRef.current?.flashError(firstError);
    }
  }, [aarsloenDownload, tableValidation.errors, triggerDownloadShake]);

  const runShDageDownload = React.useCallback(async () => {
    await shDageDownload.download(undefined);
  }, [shDageDownload]);

  // De to outputs deler fejlboksen. Gate-blokeringer bærer ingen besked (knappernes tooltip ejer årsagen),
  // så boksen viser kun et stale-afbrud eller en død DEV-server. En blokeret årsløn-download besvares
  // visuelt med shake + celle-flash.
  const downloadErrorMessage = firstPageMessage(
    pageMessage(aarsloenDownload.errorMessage),
    pageMessage(shDageDownload.errorMessage)
  );

  const canShowOmregning = omregningAktiveret && periodeData !== null;
  const visDownloadVedSammentaelling = !omregningAktiveret || beregningsData.erEtAar;
  const shouldShowFerieFields = React.useMemo(() => shouldShowAarsloenFerieFields(values), [values]);
  const shouldShowShDageFields = React.useMemo(() => shouldShowAarsloenShDageFields(values), [values]);
  const shouldWarnFeriePct = React.useMemo(() => shouldWarnAarsloenFeriePct(values), [values]);
  const indtastetEnhedSummary = React.useMemo(
    () => resolveAarsloenIndtastetEnhedSummary({
      tableData: values.tableData,
      periodeData,
      beregningsData,
      loenperiode: values.loenperiode,
    }),
    [beregningsData, periodeData, values.loenperiode, values.tableData]
  );

  /** Løntabellens satser — samme afsluttede procenter, som beregningen bruger. */
  const tableSatser = React.useMemo(
    () => ({
      ferie: values.feriePct,
      fritvalg: values.fritvalgPct,
      shSo: values.shSoPct,
      bededag: values.storeBededagPct,
      pension: values.pensionPct,
    }),
    [values.feriePct, values.fritvalgPct, values.pensionPct, values.shSoPct, values.storeBededagPct]
  );

  return withPageMessages<'beregningsFejl' | 'downloadErrorMessage'>()({
    fields: FIELDS,
    locations: LOCATIONS,
    tableLocationNav: TABLE_LOCATION_NAV,
    tabelRef,
    toggleRef,
    values,
    tableSatser,
    // Omregning
    omregningChecked,
    omregningAktiveret,
    decideOmregningToggle,
    canShowOmregning,
    // Beregning
    harFatalBeregningsFejl,
    beregnetAarsloen,
    beregningsData,
    beregningsFejl,
    fejlmeddelelser,
    shDageAntal,
    indtastetEnhedSummary,
    visDownloadVedSammentaelling,
    // Synlighed
    shouldShowFerieFields,
    shouldShowShDageFields,
    shouldWarnFeriePct,
    // Dokumenter
    aarsloenDownload,
    shDageDownload,
    downloadShake,
    downloadErrorMessage,
    runAarsloenDownload,
    runShDageDownload,
    // `withPageMessages` KONTROLLERER besked-felterne mod `PageMessage` gennem sin `TVm extends
    // PageMessageFields<TKeys>`-constraint, mens `TVm` infereres, så alle øvrige felter beholder deres præcise
    // type. Det er den grænse, den tomme "Kritisk Fejl"-boks manglede: uden den er sidens context-type
    // inferensen selv, og en forkert typet besked har intet at afvige fra. Et efterstillet `satisfies
    // PageMessageFields<…>` ville derimod indsnævre literalen til KUN besked-felterne, så `fields`/`locations`
    // blev excess-property-fejl — constrainten er det rigtige sted for kontrollen.
  });
}
