import React from 'react';
import { Box, Typography, MenuItem } from '@mui/material';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import GreenfieldPercentField from '../../inputCore/react/fields/GreenfieldPercentField';
import GreenfieldRadioField from '../../inputCore/react/fields/GreenfieldRadioField';
import GreenfieldChoiceField from '../../inputCore/react/fields/GreenfieldChoiceField';
import GreenfieldToggleField from '../../inputCore/react/fields/GreenfieldToggleField';
import GreenfieldIntegerField from '../../inputCore/react/fields/GreenfieldIntegerField';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import StandardLoenTable from '../tables/StandardLoenTable';
import { APP_ROUTES } from '../../config/pageNavigation';
import { aarsloenStandardLoenFieldSet } from '../tables/standardLoenTableFieldSet';
import ContentBox from '../layout/ContentBox';
import { useInputEvaluation, useCriticalInputActions } from '../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../inputCore/react/useFieldEditor';
import { captureProductionEvaluationSource } from '../../inputCore/react/productionInputRuntime';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import { useAarsloenDocumentGates, type AarsloenDocumentSnapshot } from '../../hooks/useAarsloenDocumentGates';
import { useAppSettings } from '../../contexts/useAppSettings';
import { formatCountWithUnit, formatCurrency } from '../../utils/formatUtils';
import { STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR } from '../../utils/periodeBeregning';
import {
  aarsloenFeriePctField,
  aarsloenFritvalgPctField,
  aarsloenFuldLoenUnderFerieField,
  aarsloenLoenPaaHelligdageField,
  aarsloenLoenperiodeField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenPensionPctField,
  aarsloenRetTilSjetteFerieugeField,
  aarsloenAntalFeriedageField,
  aarsloenShSoPctField,
  aarsloenStoreBededagPctField,
  aarsloenTillaegAngivesSomField,
} from '../../inputCore/catalog/aarsloenDescriptors';
import { buildAarsloenReaderProjection } from '../../domain/aarsloen/aarsloenProjection';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import { resolveAarsloenIndtastetEnhedSummary } from '../../domain/aarsloen/aarsloenPeriodDisplay';
import {
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../domain/policies/aarsloenPolicy';
import type { StandardLoenTableHandle } from '../../types/handles';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import type { LoenPaaHelligdage, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas/enumSchemas';
import { sourceTokensEqual, type EvaluationSourceToken } from '../../inputCore/evaluationSource';

// Greenfield-migreret, Pass 2 (§2.4 formularrækkefølge trin 3 + §2.5 / Fase 3 Årsløn-slice). HELE siden kører nu
// på greenfield-inputCore: Satser-blokken (Pass 1), løntabellen (StandardLoenTable over grid-adapteren) OG
// beregningsprincip-blokken skriver/læser gennem den offentlige `InputReader` + den ene write-grænse — der er
// ingen `usePersistedForm`-legacy-sink længere. Alle `values` til calc/render læses via `readAarsloenValues`, og
// løntabellens valideringssummary er reader-afledt (`resolveStandardLoenTableValidation`), så omregning-gaten og
// dokumentgaten deler præcis samme sandhed som cellernes røde issues. Beregningstal og synlig adfærd er uændrede.

// Stabile felt-refs + editorlokationer (§3.2): locationId er editor-metadata, ikke dataidentitet.
const feriePctRef = aarsloenFeriePctField.bind();
const fritvalgPctRef = aarsloenFritvalgPctField.bind();
const shSoPctRef = aarsloenShSoPctField.bind();
const storeBededagPctRef = aarsloenStoreBededagPctField.bind();
const pensionPctRef = aarsloenPensionPctField.bind();
const loenperiodeRef = aarsloenLoenperiodeField.bind();
// Påkrævet valg (allowEmpty=false): descriptorens værditype er ikke-optionel, men Greenfield-choice-/radio-skallen
// er typet på `TValue | undefined`. Værdien er altid defineret (tomværdi 'procent'/'maaned'); widening er sikker.
const tillaegAngivesSomRef = aarsloenTillaegAngivesSomField.bind() as FieldRef<TillaegAngivesSom | undefined>;
const loenPaaHelligdageRef = aarsloenLoenPaaHelligdageField.bind() as FieldRef<LoenPaaHelligdage | undefined>;
const fuldLoenUnderFerieRef = aarsloenFuldLoenUnderFerieField.bind();
const retTilSjetteFerieugeRef = aarsloenRetTilSjetteFerieugeField.bind();
const antalFeriedageRef = aarsloenAntalFeriedageField.bind();
const omregningTilFuldtAarRef = aarsloenOmregningTilFuldtAarField.bind();
// route er eksplicit navigation-metadata (§3.7); Årsløn er en side uden faner (tabKey: null).
const loc = (field: string): { locationId: string; route: string; tabKey: null } =>
  ({ locationId: `aarsloen:${field}`, route: APP_ROUTES.aarsloen, tabKey: null });

const LOENPERIODE_OPTIONS: readonly { value: Loenperiode; label: string }[] = [
  { value: LOENPERIODE.MAANED, label: 'Måned' },
  { value: LOENPERIODE.UGE, label: 'Uge' },
  { value: LOENPERIODE.DAG, label: 'Dato' },
];

const captureFreshAarsloenDocumentSnapshot = (
  expectedToken: EvaluationSourceToken
): AarsloenDocumentSnapshot | null => {
  const source = captureProductionEvaluationSource();
  if (!sourceTokensEqual(expectedToken, source.evaluation.issues.sourceToken)) return null;

  const projection = buildAarsloenReaderProjection(source.evaluation.reader);

  return {
    values: projection.values,
    omregningAktiveret: projection.omregningGate.effectiveEnabled,
    periodeData: projection.calculation.periodeData,
    shDageAntal: projection.calculation.shDageAntal,
    beregnetAarsloen: projection.calculation.beregnetAarsloen,
    beregningsData: projection.calculation.beregningsData,
    harFatalBeregningsFejl: projection.calculation.harFatalBeregningsFejl || projection.fieldIssues.length > 0,
    tableErrors: projection.tableValidation.errors,
    stamdataProjection: projection.documentStamdata,
    settings: source.settings,
    isSourceCurrent: source.isSourceCurrent,
  };
};

/**
 * Årsløn-side
 *
 * Beregner årsløn baseret på satser og indtægtsoplysninger
 */
const Aarsloen = React.memo(() => {
  const { settings } = useAppSettings();
  const evaluation = useInputEvaluation();
  const criticalActions = useCriticalInputActions();

  const readerProjection = React.useMemo(
    () => buildAarsloenReaderProjection(evaluation.reader),
    [evaluation]
  );
  const { values } = readerProjection;

  const {
    feriePct, tillaegAngivesSom, tableData, loenperiode,
    fuldLoenUnderFerie, retTilSjetteFerieuge,
  } = values;

  // Løntabellens valideringssummary er REN og reader-afledt (§2.5) — ét sted for både omregning-gaten og
  // dokumentgaten, i sync med cellernes røde issues.
  const { tableValidation } = readerProjection;

  const tabelRef = React.useRef<StandardLoenTableHandle | null>(null);

  // Omregning-toggle: den persisterede canonical værdi + den centrale gate. Toggle-visning og skjult indhold
  // reagerer på samme committed forudsætninger (gate). Selve committen går gennem den ene write-grænse
  // (`omregningController.commitImmediate`), men GATES her, så en ugyldig aktivering ikke skriver.
  const omregningController = useFieldEditor(omregningTilFuldtAarRef, loc('omregningTilFuldtAar'));
  const toggleRef = React.useRef<{ shake: () => void } | null>(null);

  const { omregningGate } = readerProjection;

  const { checked: omregningChecked, effectiveEnabled: omregningAktiveret, handleToggle: handleOmregningToggle } = useOmregningToggle({
    gate: omregningGate,
    tabelRef,
    toggleRef,
    onEnabledChange: (enabled) => {
      omregningController.commitImmediate(enabled);
      return true;
    },
  });

  // Alle beregninger (periode, SH-dage, årsløn, omregning) — kører UÆNDRET på de reader-rekonstruerede `values`.
  const {
    periodeData,
    shDageAntal,
    beregnetAarsloen,
    beregningsData,
    fejlmeddelelser,
    beregningsFejl,
    harFatalBeregningsFejl: harFatalBeregningsFejlFraCalc,
  } = readerProjection.calculation;

  // Greenfield fatal-gate (§1.6/§5.4): et satsinput uden for 0–100 (eller antalFeriedage uden for 0–99) er nu en
  // RØD feltfejl. Readeren skjuler den værdi, så et misvisende beregnet resultat undertrykkes her — samme gating
  // som legacy's `harFatalBeregningsFejl`, kun anden præsentation.
  const fieldErrorGate = readerProjection.fieldIssues;
  const harFatalBeregningsFejl = harFatalBeregningsFejlFraCalc || fieldErrorGate.length > 0;

  // Stamdata til dokument-download hentes gennem readeren (§3.4/§5.4), ikke via en rå sektionsselector.
  const stamdataProjection = readerProjection.documentStamdata;

  // PDF gates og download handlers
  const {
    canDownloadDocument,
    documentDisabledReason,
    canDownloadSHDageDocument,
    shDageDisabledReason,
    handleAarsloenDocumentDownload,
    handleSHDageDocumentDownload,
    downloadShake,
    downloadErrorMessage,
  } = useAarsloenDocumentGates({
    values,
    omregningAktiveret,
    periodeData,
    shDageAntal,
    beregnetAarsloen,
    beregningsData,
    harFatalBeregningsFejl,
    tableErrors: tableValidation.errors,
    tabelRef,
    stamdataProjection,
    settings,
    // Render-snapshottet bruges kun til knaptilstand. Selve downloadhandlingen leverer altid et frisk snapshot.
    isSourceCurrent: () => false,
  });

  // §1.4/§3.9: en download settler først en evt. åben celle-/felt-editor og evaluerer derefter et frisk
  // kildesnapshot, før gaten genkøres. Gaten/handleren selv ejer beregningen; her sikrer vi kun, at en netop
  // indtastet celle er committet, før downloaden læser.
  const runAarsloenDownload = React.useCallback(async () => {
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const latest = captureFreshAarsloenDocumentSnapshot(preparation.token);
    if (latest === null) return;
    await handleAarsloenDocumentDownload(latest);
  }, [criticalActions, handleAarsloenDocumentDownload]);

  const runShDageDownload = React.useCallback(async () => {
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const latest = captureFreshAarsloenDocumentSnapshot(preparation.token);
    if (latest === null) return;
    await handleSHDageDocumentDownload(latest);
  }, [criticalActions, handleSHDageDocumentDownload]);

  // Afledt boolean til betinget rendering
  const canShowOmregning = omregningAktiveret && periodeData !== null;
  const visDownloadVedSammentaelling = !omregningAktiveret || beregningsData.erEtAar;
  const shouldShowFerieFields = React.useMemo(() => shouldShowAarsloenFerieFields(values), [values]);
  const shouldShowShDageFields = React.useMemo(() => shouldShowAarsloenShDageFields(values), [values]);
  const shouldWarnFeriePct = React.useMemo(() => shouldWarnAarsloenFeriePct(values), [values]);
  const indtastetEnhedSummary = React.useMemo(
    () => resolveAarsloenIndtastetEnhedSummary({ tableData, periodeData, beregningsData, loenperiode }),
    [beregningsData, loenperiode, periodeData, tableData]
  );

  const aarsloenPdfDownloadButton = (
    <DocumentDownloadButton
      onClick={() => void runAarsloenDownload()}
      shake={downloadShake}
      disabled={!canDownloadDocument}
      disabledReason={documentDisabledReason ?? undefined}
    />
  );

  return (
    <Box>
      <Typography className="page-title">Årslønsberegning</Typography>

      {beregningsFejl && (
        <ContentBox className="content-box">
          <Typography className="section-header">Kritisk Fejl</Typography>
          <Typography className="row--text" sx={{ color: 'error.main' }}>
            {beregningsFejl}
          </Typography>
        </ContentBox>
      )}

      {/* Container 1: Satser */}
      <ContentBox className="content-box">
        <Typography className="section-header">Satser</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn indtastes som:</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldRadioField<Loenperiode>
              field={loenperiodeRef}
              location={loc('loenperiode')}
              name="loenperiode"
              row
              options={LOENPERIODE_OPTIONS}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Tillæg angives som</Typography>
          <Box className="row--label-right-hover__content">
            <GreenfieldChoiceField<TillaegAngivesSom>
              field={tillaegAngivesSomRef}
              location={loc('tillaegAngivesSom')}
              name="tillaegAngivesSom"
              width={185}
              allowEmpty={false}
            >
              <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
              <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
            </GreenfieldChoiceField>
          </Box>
        </Box>

        {tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
          <>
            <Box className="row--label-right-hover">
              <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>Feriegodtgørelse/-tillæg:</Typography>
                  <GreenfieldPercentField field={feriePctRef} location={loc('feriePct')} name="feriePct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                  <GreenfieldPercentField field={fritvalgPctRef} location={loc('fritvalgPct')} name="fritvalgPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '140px' }}>SH/SO-sats:</Typography>
                  <GreenfieldPercentField field={shSoPctRef} location={loc('shSoPct')} name="shSoPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>Store Bededagstillæg:</Typography>
                  <GreenfieldPercentField field={storeBededagPctRef} location={loc('storeBededagPct')} name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '190px' }}>Arbejdsgivers pensionsbidrag:</Typography>
                  <GreenfieldPercentField field={pensionPctRef} location={loc('pensionPct')} name="pensionPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
              </Box>
            </Box>
          </>
        )}
      </ContentBox>

      {/* Container 2: Indtægtsoplysninger */}
      <ContentBox className="content-box">
        <Typography className="section-header">Indtægtsoplysninger</Typography>

        <StandardLoenTable
          ref={tabelRef}
          fieldSet={aarsloenStandardLoenFieldSet}
          loenperiode={loenperiode}
          locationNav={{ route: APP_ROUTES.aarsloen, tabKey: null }}
          tillaegAngivesSom={tillaegAngivesSom}
          satser={{
            ferie: values.feriePct,
            fritvalg: values.fritvalgPct,
            shSo: values.shSoPct,
            bededag: values.storeBededagPct,
            pension: values.pensionPct,
          }}
          useSmallFont={true}
          saveOrderPath="aarsloen.tableData"
        />
      </ContentBox>

      {/* Container 3: Beregningsprincipper */}
      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsprincipper</Typography>

        {/* Omregning til fuldt år — GATET immediate-commit (checked = persisted input, ikke effectiveEnabled). */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Omregning til fuldt år:</Typography>
          <Box className="row--label-right-hover__content">
            <StyledToggleSwitch
              name="omregningTilFuldtAar"
              ref={toggleRef}
              checked={omregningChecked}
              onCommit={handleOmregningToggle}
            />
          </Box>
        </Box>

        <Box sx={{ display: canShowOmregning ? 'block' : 'none' }}>
          <Box className="row--label-right-hover">
            <Typography className="row--text">{`${indtastetEnhedSummary.label}:`}</Typography>
            <Typography className="row--text">{indtastetEnhedSummary.value}</Typography>
          </Box>

          {/* Fuld løn under ferie */}
          <Box className="row--label-right-hover">
            <Typography className="row--text">Fuld løn under ferie:</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldToggleField
                name="fuldLoenUnderFerie"
                field={fuldLoenUnderFerieRef}
                location={loc('fuldLoenUnderFerie')}
                disabled={!canShowOmregning}
              />
            </Box>
          </Box>

          {/* Ret til 6. ferieuge — kun synlig hvis IKKE fuld løn under ferie */}
          <Box sx={{ display: shouldShowFerieFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Ret til 6. ferieuge:</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldToggleField
                  name="retTilSjetteFerieuge"
                  field={retTilSjetteFerieugeRef}
                  location={loc('retTilSjetteFerieuge')}
                  disabled={!canShowOmregning}
                />
              </Box>
            </Box>
          </Box>

          {/* Antal feriedage — kun synlig hvis IKKE fuld løn under ferie */}
          <Box sx={{ display: shouldShowFerieFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Antal feriedage (mandag-fredag) i de indtastede perioder:</Typography>
              <Box className="row--label-right-hover__content">
                <GreenfieldIntegerField
                  name="antalFeriedage"
                  field={antalFeriedageRef}
                  location={loc('antalFeriedage')}
                  placeholder="0"
                  width={50}
                  disabled={!canShowOmregning}
                />
              </Box>
            </Box>
          </Box>

          {/* Løn på helligdage */}
          <Box className="row--label-right-hover">
            <Typography className="row--text">Løn på helligdage:</Typography>
            <Box className="row--label-right-hover__content">
              <GreenfieldChoiceField<LoenPaaHelligdage>
                name="loenPaaHelligdage"
                field={loenPaaHelligdageRef}
                location={loc('loenPaaHelligdage')}
                width={185}
                allowEmpty={false}
                disabled={!canShowOmregning}
              >
                <MenuItem value={LOEN_PAA_HELLIGDAGE.ALMINDELIG}>Almindelig løn</MenuItem>
                <MenuItem value={LOEN_PAA_HELLIGDAGE.SH_UDBETALING}>SH-udbetaling</MenuItem>
                <MenuItem value={LOEN_PAA_HELLIGDAGE.INGEN}>Ingen</MenuItem>
              </GreenfieldChoiceField>
            </Box>
          </Box>

          {/* SH-dage — kun synlig hvis dropdown er 'SH-udbetaling' eller 'Ingen' */}
          <Box sx={{ display: shouldShowShDageFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Antal SH-dage i de indtastede perioder:</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">{shDageAntal ?? 0}</Typography>
                  <DocumentDownloadButton
                    onClick={() => void runShDageDownload()}
                    disabled={!canDownloadSHDageDocument}
                    disabledReason={shDageDisabledReason ?? undefined}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </ContentBox>

      {/* Container 3.5: Advarsler */}
      {(fejlmeddelelser.length > 0 || shouldWarnFeriePct) && (
        <ContentBox className="content-box">
          <Typography className="section-header">Advarsler</Typography>

          {fejlmeddelelser.map((fejl, index) => (
            <Box key={index} className="row--label-right-hover">
              <Typography className="row--text">{fejl}</Typography>
              <Box />
            </Box>
          ))}

          {shouldWarnFeriePct && (
            <Box className="row--label-right-hover">
              <Typography className="row--text">{`En feriegodtgørelsessats på ${feriePct} % skaber en klar formodning for, at der er ret til 6. ferieuge.`}</Typography>
              <Box />
            </Box>
          )}
        </ContentBox>
      )}

      {downloadErrorMessage && (
        <ContentBox className="content-box">
          <Typography className="section-header">Dokument-fejl</Typography>
          <Typography className="row--text" sx={{ color: 'error.main' }}>
            {downloadErrorMessage}
          </Typography>
        </ContentBox>
      )}

      {/* Container 5: Beregning */}
      <ContentBox className="content-box">
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Sammentælling af løn fra tabellen:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text">{harFatalBeregningsFejl ? '—' : `${formatCurrency(beregnetAarsloen)} kr.`}</Typography>
            {visDownloadVedSammentaelling && aarsloenPdfDownloadButton}
          </Box>
        </Box>

        {omregningAktiveret && !harFatalBeregningsFejl && beregningsData.metode !== 'ingen' && !beregningsData.erEtAar && (
          <>
            {beregningsData.metode === 'A' && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Arbejdsdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}${(shDageAntal ?? 0) > 0 ? ` - ${formatCountWithUnit(shDageAntal ?? 0, 'SH-dag', 'SH-dage')}` : ''}):`}</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'arbejdsdag', 'arbejdsdage')}</Typography>
                </Box>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{fuldLoenUnderFerie
                    ? `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                    : `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} feriedage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                  }</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdagePaaAar, 'arbejdsdag', 'arbejdsdage')}</Typography>
                </Box>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar}):`}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                    {aarsloenPdfDownloadButton}
                  </Box>
                </Box>
              </>
            )}

            {beregningsData.metode === 'B' && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}):`}</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
                </Box>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{fuldLoenUnderFerie
                    ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                    : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                  }</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
                </Box>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar}):`}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                    {aarsloenPdfDownloadButton}
                  </Box>
                </Box>
              </>
            )}

            {beregningsData.metode === 'C' && (
              <>
                {loenperiode === LOENPERIODE.MAANED && (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                      <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'måned', 'måneder')}</Typography>
                    </Box>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 12):`}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                        {aarsloenPdfDownloadButton}
                      </Box>
                    </Box>
                  </>
                )}

                {loenperiode === LOENPERIODE.UGE && (
                  <>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal uger i indtastede perioder:</Typography>
                      <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'uge', 'uger')}</Typography>
                    </Box>
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalEnheder} × 52,14):`}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                        {aarsloenPdfDownloadButton}
                      </Box>
                    </Box>
                  </>
                )}

                {loenperiode === LOENPERIODE.DAG && (
                  <>
                    {beregningsData.antalHeleKalendermaaneder !== null ? (
                      <>
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.antalHeleKalendermaaneder, 'måned', 'måneder')}</Typography>
                        </Box>
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.antalHeleKalendermaaneder} × 12):`}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                            {aarsloenPdfDownloadButton}
                          </Box>
                        </Box>
                      </>
                    ) : (
                      <>
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}):`}</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
                        </Box>
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{fuldLoenUnderFerie
                            ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                            : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                          }</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
                        </Box>
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar}):`}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                            {aarsloenPdfDownloadButton}
                          </Box>
                        </Box>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </ContentBox>
    </Box>
  );
});

Aarsloen.displayName = 'Aarsloen';

export default Aarsloen;
