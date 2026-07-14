import React from 'react';
import { Box, Typography, MenuItem } from '@mui/material';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import StyledPercentField from '../inputs/StyledPercentField';
import StyledRadioButton from '../inputs/StyledRadioButton';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import StyledIntegerField from '../inputs/StyledIntegerField';
import StyledDropdown from '../inputs/StyledDropdown';
import StandardLoenTable from '../tables/StandardLoenTable';
import { CellInvalidDraftScopeProvider } from '../../contexts/CellInvalidDraftScopeContext';
import { CELL_TABLE_IDS } from '../../config/cellInvalidDraftScopes';
import ContentBox from '../layout/ContentBox';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { useFormFieldErrorReporter } from '../../hooks/useFormFieldErrors';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import { useAarsloenBeregning } from '../../hooks/useAarsloenBeregning';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import { useAarsloenDocumentGates } from '../../hooks/useAarsloenDocumentGates';
import { useAppSettings } from '../../contexts/useAppSettings';
import { formatCountWithUnit, formatCurrency } from '../../utils/formatUtils';
import { STANDARD_HVERDAGE_PAA_AAR, STANDARD_SH_DAGE_PAA_AAR } from '../../utils/periodeBeregning';
import { aarsloenSchema } from '../../schemas/formSchemas';
import { isLoenperiodeValue, isLoenPaaHelligdageValue, isTillaegAngivesSomValue } from '../../utils/zodTypeGuards';
import {
  EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY,
  resolveAarsloenOmregningGate,
} from '../../domain/aarsloen/aarsloenValidationPolicies';
import { resolveAarsloenIndtastetEnhedSummary } from '../../domain/aarsloen/aarsloenPeriodDisplay';
import {
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../domain/policies';
import { createAarsloenInitialValues } from '../../domain/aarsloen/aarsloenInitialValues';
import type { z } from 'zod';
import type {
  StandardLoenTableValidationSummary,
} from '../../types/table';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../../types/handles';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import type { StyledPercentFieldValueChangeEvent } from '../inputs/StyledPercentField';
import type { StyledIntegerFieldValueChangeEvent } from '../inputs/StyledIntegerField';
import type { StyledDropdownChangeEvent } from '../inputs/StyledDropdown';
import type { CommitEvent, CommitHandler } from '../../types/fieldEvents';

// Udled type fra Zod-schema (source of truth for runtime-validering)
type AarsloenValues = z.infer<typeof aarsloenSchema>;

/**
 * Årsløn-side
 *
 * Beregner årsløn baseret på satser og indtægtsoplysninger
 */
const Aarsloen = React.memo(() => {
  const { settings } = useAppSettings();

  // Initial values baseret på settings (bruges kun ved oprettelse af NY sag)
  const initialValues = React.useMemo(
    () => createAarsloenInitialValues(settings),
    [settings]
  );

  // Persisted state for satser og beregning (med Zod-schema validering)
  const { values, setValues, setFieldValue } = usePersistedForm(
    aarsloenSchema,
    'aarsloen',
    initialValues
  );

  // Felt-fejl-reportere: binder hvert persisteret felts ugyldige rå draft til den centrale invalidDrafts-
  // kanal (greenfield draft/commit §4.3 — binding er obligatorisk for sagsfelter). Uden dem lever et
  // ugyldigt input kun i useDraftields lokale fallback: usynligt for read-model/save-gate og tabt ved F5.
  const feriePctError = useFormFieldErrorReporter('aarsloen', 'feriePct');
  const fritvalgPctError = useFormFieldErrorReporter('aarsloen', 'fritvalgPct');
  const shSoPctError = useFormFieldErrorReporter('aarsloen', 'shSoPct');
  const storeBededagPctError = useFormFieldErrorReporter('aarsloen', 'storeBededagPct');
  const pensionPctError = useFormFieldErrorReporter('aarsloen', 'pensionPct');
  const antalFeriedageError = useFormFieldErrorReporter('aarsloen', 'antalFeriedage');

  // Destrukturér værdier for nem adgang
  const persistedStamdata = usePersistedSectionSelector('stamdata');

  const {
    feriePct, fritvalgPct, shSoPct, storeBededagPct, pensionPct, loenperiode, tillaegAngivesSom, tableData,
    fuldLoenUnderFerie, retTilSjetteFerieuge, antalFeriedage, loenPaaHelligdage
  } = values;

  // Refs til fejl-validering
  const [tableValidationSummary, setTableValidationSummary] = React.useState<StandardLoenTableValidationSummary>(
    EMPTY_STANDARD_LOEN_TABLE_VALIDATION_SUMMARY
  );
  const tabelRef = React.useRef<StandardLoenTableHandle | null>(null);
  const toggleRef = React.useRef<StyledToggleSwitchHandle | null>(null);

  // ============================================================================
  // CUSTOM HOOKS - Separation of concerns
  // ============================================================================

  const omregningGate = React.useMemo(
    () => resolveAarsloenOmregningGate({
      requestedEnabled: values.omregningTilFuldtAar,
      tableData: values.tableData,
      loenperiode: values.loenperiode,
      validationSummary: tableValidationSummary,
    }),
    [tableValidationSummary, values.loenperiode, values.omregningTilFuldtAar, values.tableData]
  );

  // Toggle state management.
  // requestedEnabled    = persisted brugerønske.
  // omregningGate       = centralt gate-resultat fra committed tabelstate.
  // checked/effectiveEnabled bruger samme gate, så toggle-visning og skjult indhold
  // altid reagerer på de samme committed forudsætninger.
  const { checked: omregningChecked, effectiveEnabled: omregningAktiveret, handleToggle: handleOmregningToggle } = useOmregningToggle({
    gate: omregningGate,
    tabelRef,
    toggleRef,
    onEnabledChange: (enabled) => {
      return setValues(prev => ({ ...prev, omregningTilFuldtAar: enabled }), { fieldPath: 'omregningTilFuldtAar' });
    },
  });

  // Alle beregninger (periode, SH-dage, årsløn, omregning)
  const {
    periodeData,
    shDageAntal,
    beregnetAarsloen,
    beregningsData,
    fejlmeddelelser,
    beregningsFejl,
    harFatalBeregningsFejl,
  } = useAarsloenBeregning({
    values,
    omregningAktiveret,
  });

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
    tabelRef,
    persistedStamdata,
    settings,
  });

  // ============================================================================
  // FIELD HANDLERS
  // ============================================================================

  // Stabile callbacks for alle felt-opdateringer (memoized map). Via setFieldValue → gyldigt commit
  // rydder feltets ugyldige rå draft ATOMISK i samme transaktion (greenfield draft/commit §4.4).
  const setField = React.useCallback(<K extends keyof AarsloenValues>(fieldName: K, value: AarsloenValues[K]) => {
    return setFieldValue(fieldName, value);
  }, [setFieldValue]);

  const fieldHandlers = React.useMemo(() => {
    type PercentFieldName = 'feriePct' | 'fritvalgPct' | 'shSoPct' | 'storeBededagPct' | 'pensionPct';

    const createPercentHandler = (fieldName: PercentFieldName) =>
      (e: StyledPercentFieldValueChangeEvent) => {
        return setField(fieldName, e.target.value);
      };

    const createIntegerHandler = (fieldName: 'antalFeriedage') =>
      (e: StyledIntegerFieldValueChangeEvent) => {
        return setField(fieldName, e.target.value);
      };

    return {
      feriePct: createPercentHandler('feriePct'),
      fritvalgPct: createPercentHandler('fritvalgPct'),
      shSoPct: createPercentHandler('shSoPct'),
      storeBededagPct: createPercentHandler('storeBededagPct'),
      pensionPct: createPercentHandler('pensionPct'),
      antalFeriedage: createIntegerHandler('antalFeriedage'),
    } as const;
  }, [setField]);

  // Funktion til at opdatere tabeldata (type-safe)
  const handleTableDataChange = React.useCallback((newTableData: AarsloenValues['tableData'], options?: Readonly<{ fieldPath?: string }>) => {
    return setValues(prev => ({ ...prev, tableData: newTableData }), { fieldPath: options?.fieldPath ?? 'tableData' });
  }, [setValues]);

  // Type-safe funktion til at opdatere toggle-felter
  type BooleanFieldName = 'fuldLoenUnderFerie' | 'retTilSjetteFerieuge';

  const updateToggle = React.useCallback(
    (fieldName: BooleanFieldName): CommitHandler<boolean> =>
      (event: CommitEvent<boolean>) => {
        return setField(fieldName, event.target.value);
      },
    [setField]
  );

  const handleLoenperiodeChange = React.useCallback((_event: React.ChangeEvent<HTMLInputElement>, value: string) => {
    if (!isLoenperiodeValue(value)) return;
    setField('loenperiode', value);
  }, [setField]);

  const handleTillaegAngivesSomChange = React.useCallback((e: StyledDropdownChangeEvent) => {
    const nextValue = e.target.value;
    if (!isTillaegAngivesSomValue(nextValue)) return;
    setField('tillaegAngivesSom', nextValue);
  }, [setField]);

  const handleLoenPaaHelligdageChange = React.useCallback((e: StyledDropdownChangeEvent) => {
    const nextValue = e.target.value;
    if (!isLoenPaaHelligdageValue(nextValue)) return;
    setField('loenPaaHelligdage', nextValue);
  }, [setField]);

  // Memoized MenuItem children for 'Løn på helligdage'
  const loenPaaHelligdageOptions = React.useMemo(() => [
    <MenuItem key="almindelig" value={LOEN_PAA_HELLIGDAGE.ALMINDELIG}>Almindelig løn</MenuItem>,
    <MenuItem key="sh" value={LOEN_PAA_HELLIGDAGE.SH_UDBETALING}>SH-udbetaling</MenuItem>,
    <MenuItem key="ingen" value={LOEN_PAA_HELLIGDAGE.INGEN}>Ingen</MenuItem>
  ], []);

  /**
   * Callback fra StandardLoenTable når validerings-status ændres (type-safe)
   */
  const handleValidationChange = React.useCallback((summary: StandardLoenTableValidationSummary) => {
    setTableValidationSummary(summary);
  }, []);

  // Afledt boolean til betinget rendering
  const canShowOmregning = omregningAktiveret && periodeData !== null;
  // Når omregning er aktiveret springes mellemregningen (med dens download-knap) over hvis
  // perioden er præcis ét år (erEtAar). Vis i så fald download-knappen ved sammentællingen i
  // stedet, så beregningen altid kan downloades — også ved nøjagtig 12 måneder.
  const visDownloadVedSammentaelling = !omregningAktiveret || beregningsData.erEtAar;
  const shouldShowFerieFields = React.useMemo(
    () => shouldShowAarsloenFerieFields(values),
    [values]
  );
  const shouldShowShDageFields = React.useMemo(
    () => shouldShowAarsloenShDageFields(values),
    [values]
  );
  const shouldWarnFeriePct = React.useMemo(
    () => shouldWarnAarsloenFeriePct(values),
    [values]
  );
  const indtastetEnhedSummary = React.useMemo(
    () => resolveAarsloenIndtastetEnhedSummary({
      tableData,
      periodeData,
      beregningsData,
      loenperiode,
    }),
    [beregningsData, loenperiode, periodeData, tableData]
  );

  // Download-ikonet vises altid sammen med sin tekstlinje — nedtonet/inaktivt når download
  // er blokeret (fx tabel-valideringsfejl eller manglende gyldige rækker), med årsag i tooltip.
  const aarsloenPdfDownloadButton = (
    <DocumentDownloadButton
      onClick={() => void handleAarsloenDocumentDownload()}
      shake={downloadShake}
      disabled={!canDownloadDocument}
      disabledReason={documentDisabledReason ?? undefined}
    />
  );

  return (
    <Box>
      {/* Header */}
      <Typography className="page-title">Årslønsberegning</Typography>

      {/* Vis beregningsfejl hvis der er nogen */}
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

        {/* Løn indtastes som + Tillæg angives som placeres øverst, jf. EO-siden.
            I Beløb-tilstand skjules selve sats-procentfelterne. */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Løn indtastes som:</Typography>
          <Box className="row--label-right-hover__content">
            <StyledRadioButton
              name="loenperiode"
              value={loenperiode}
              onChange={handleLoenperiodeChange}
              row={true}
              options={[
                { value: LOENPERIODE.MAANED, label: 'Måned' },
                { value: LOENPERIODE.UGE, label: 'Uge' },
                { value: LOENPERIODE.DAG, label: 'Dato' },
              ]}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Tillæg angives som</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDropdown
              name="tillaegAngivesSom"
              width={185}
              value={tillaegAngivesSom}
              onChange={handleTillaegAngivesSomChange}
              allowEmpty={false}
            >
              <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
              <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        {tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
          <>
        {/* Første række: 3 felter */}
        <Box className="row--label-right-hover">
          <Box
            sx={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text" sx={{ minWidth: '160px' }}>
                Feriegodtgørelse/-tillæg:
              </Typography>
              <StyledPercentField
                name="feriePct"
                value={feriePct}
                onCommit={fieldHandlers.feriePct}
                onFieldError={feriePctError}
                placeholder="0"
                useDefaultPercentRange
                sx={{ width: '100px' }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
              <StyledPercentField
                name="fritvalgPct"
                value={fritvalgPct}
                onCommit={fieldHandlers.fritvalgPct}
                onFieldError={fritvalgPctError}
                placeholder="0"
                useDefaultPercentRange
                sx={{ width: '100px' }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text" sx={{ minWidth: '140px' }}>
                SH/SO-sats:
              </Typography>
              <StyledPercentField
                name="shSoPct"
                value={shSoPct}
                onCommit={fieldHandlers.shSoPct}
                onFieldError={shSoPctError}
                placeholder="0"
                useDefaultPercentRange
                sx={{ width: '100px' }}
              />
            </Box>
          </Box>
        </Box>

        {/* Anden række: 2 felter */}
        <Box className="row--label-right-hover">
          <Box
            sx={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text" sx={{ minWidth: '160px' }}>
                Store Bededagstillæg:
              </Typography>
              <StyledPercentField
                name="storeBededagPct"
                value={storeBededagPct}
                onCommit={fieldHandlers.storeBededagPct}
                onFieldError={storeBededagPctError}
                placeholder="0"
                useDefaultPercentRange
                sx={{ width: '100px' }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography className="row--text" sx={{ minWidth: '190px' }}>
                Arbejdsgivers pensionsbidrag:
              </Typography>
              <StyledPercentField
                name="pensionPct"
                value={pensionPct}
                onCommit={fieldHandlers.pensionPct}
                onFieldError={pensionPctError}
                placeholder="0"
                useDefaultPercentRange
                sx={{ width: '100px' }}
              />
            </Box>
          </Box>
        </Box>
          </>
        )}

      </ContentBox>

      {/* Container 2: Indtægtsoplysninger */}
      <ContentBox className="content-box">
        <Typography className="section-header">Indtægtsoplysninger</Typography>

        <CellInvalidDraftScopeProvider pageKey="aarsloen" tableId={CELL_TABLE_IDS.aarsloenStandardLoen}>
          <StandardLoenTable
            ref={tabelRef}
            loenperiode={loenperiode}
            tillaegAngivesSom={tillaegAngivesSom}
            satser={{
              ferie: feriePct,
              fritvalg: fritvalgPct,
              shSo: shSoPct,
              bededag: storeBededagPct,
              pension: pensionPct
            }}
            tableData={tableData}
            onTableDataChange={handleTableDataChange}
            onValidationChange={handleValidationChange}
            useSmallFont={true}
            saveOrderPath="aarsloen.tableData"
          />
        </CellInvalidDraftScopeProvider>
      </ContentBox>

      {/* Container 3: Beregningsprincipper */}
      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsprincipper</Typography>

        {/* Omregning til fuldt år */}
        {/* checked = persisted input (ikke effectiveEnabled): toggle viser brugerens valg,
            mens indholdssektionen nedenfor er skjult/disabled når tabellen mangler gyldige data. */}
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

        {/* Vis periode-information kun hvis omregning er aktiveret OG der er data */}
        {/* Felter holdes permanent i DOM for at undgå MUI focus-warnings */}
        <Box sx={{ display: canShowOmregning ? 'block' : 'none' }}>
          {/* Antal indtastede beregningsenheder */}
          <Box className="row--label-right-hover">
            <Typography className="row--text">{`${indtastetEnhedSummary.label}:`}</Typography>
            <Typography className="row--text">{indtastetEnhedSummary.value}</Typography>
          </Box>

          {/* Fuld løn under ferie */}
          <Box className="row--label-right-hover">
            <Typography className="row--text">Fuld løn under ferie:</Typography>
            <Box className="row--label-right-hover__content">
              <StyledToggleSwitch
                name="fuldLoenUnderFerie"
                checked={fuldLoenUnderFerie}
                onCommit={updateToggle('fuldLoenUnderFerie')}
                disabled={!canShowOmregning}
              />
            </Box>
          </Box>

          {/* Ret til 6. ferieuge - kun synlig hvis IKKE fuld løn under ferie */}
          <Box sx={{ display: shouldShowFerieFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Ret til 6. ferieuge:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledToggleSwitch
                  name="retTilSjetteFerieuge"
                  checked={retTilSjetteFerieuge}
                  onCommit={updateToggle('retTilSjetteFerieuge')}
                  disabled={!canShowOmregning}
                />
              </Box>
            </Box>
          </Box>

          {/* Antal feriedage - kun synlig hvis IKKE fuld løn under ferie */}
          <Box sx={{ display: shouldShowFerieFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Antal feriedage (mandag-fredag) i de indtastede perioder:</Typography>
              <Box className="row--label-right-hover__content">
                <StyledIntegerField
                  name="antalFeriedage"
                  value={antalFeriedage}
                  onCommit={fieldHandlers.antalFeriedage}
                  onFieldError={antalFeriedageError}
                  placeholder="0"
                  minValue={0}
                  maxValue={99}
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
              <StyledDropdown
                name="loenPaaHelligdage"
                value={loenPaaHelligdage}
                onChange={handleLoenPaaHelligdageChange}
                width={185}
                allowEmpty={false}
                disabled={!canShowOmregning}
              >
                {loenPaaHelligdageOptions}
              </StyledDropdown>
            </Box>
          </Box>

          {/* SH-dage - kun synlig hvis dropdown er 'SH-udbetaling' eller 'Ingen' */}
          <Box sx={{ display: shouldShowShDageFields ? 'block' : 'none' }}>
            <Box className="row--label-right-hover">
              <Typography className="row--text">Antal SH-dage i de indtastede perioder:</Typography>
              <Box className="row--label-right-hover__content">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text">{shDageAntal ?? 0}</Typography>
                  <DocumentDownloadButton
                    onClick={() => void handleSHDageDocumentDownload()}
                    disabled={!canDownloadSHDageDocument}
                    disabledReason={shDageDisabledReason ?? undefined}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      </ContentBox>

      {/* Container 3.5: Advarsler - Kun synlig hvis der er fejlmeddelelser eller advarsler */}
      {(fejlmeddelelser.length > 0 || shouldWarnFeriePct) && (
        <ContentBox className="content-box">
          <Typography className="section-header">Advarsler</Typography>

          {fejlmeddelelser.map((fejl, index) => (
            <Box key={index} className="row--label-right-hover">
              <Typography className="row--text">{fejl}</Typography>
              <Box />
            </Box>
          ))}

          {/* Advarsel om feriegodtgørelsessats og 6. ferieuge */}
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

        {/* LINJE 1: ALTID VIS - Sammentælling af løn fra tabellen */}
        <Box className="row--label-right-hover">
          <Typography className="row--text">Sammentælling af løn fra tabellen:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography className="row--text">{harFatalBeregningsFejl ? '—' : `${formatCurrency(beregnetAarsloen)} kr.`}</Typography>
            {visDownloadVedSammentaelling && aarsloenPdfDownloadButton}
          </Box>
        </Box>

        {/* Conditional mellemregning - kun hvis omregning er aktiveret og der ikke er fejl */}
        {omregningAktiveret && !harFatalBeregningsFejl && beregningsData.metode !== 'ingen' && !beregningsData.erEtAar && (
          <>
            {/* METODE A: Arbejdsdage */}
            {beregningsData.metode === 'A' && (
              <>
                {/* Linje 2: Arbejdsdage i indtastede perioder */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Arbejdsdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}${(shDageAntal ?? 0) > 0 ? ` - ${formatCountWithUnit(shDageAntal ?? 0, 'SH-dag', 'SH-dage')}` : ''}):`}</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'arbejdsdag', 'arbejdsdage')}</Typography>
                </Box>

                {/* Linje 3: Arbejdsdage på et år */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{fuldLoenUnderFerie
                    ? `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                    : `Arbejdsdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} feriedage - ${STANDARD_SH_DAGE_PAA_AAR} SH-dage):`
                  }</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdagePaaAar, 'arbejdsdag', 'arbejdsdage')}</Typography>
                </Box>

                {/* Linje 4: Beregnet årsløn */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.arbejdsdagePaaAar}):`}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                    {aarsloenPdfDownloadButton}
                  </Box>
                </Box>
              </>
            )}

            {/* METODE B: Hverdage */}
            {beregningsData.metode === 'B' && (
              <>
                {/* Linje 2: Hverdage i indtastede perioder */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}):`}</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
                </Box>

                {/* Linje 3: Hverdage på et år */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{fuldLoenUnderFerie
                    ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                    : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                  }</Typography>
                  <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
                </Box>

                {/* Linje 4: Beregnet årsløn */}
                <Box className="row--label-right-hover">
                  <Typography className="row--text">{`Beregnet årsløn (${formatCurrency(beregnetAarsloen)} / ${beregningsData.arbejdsdageIPeriode} × ${beregningsData.hverdagePaaAar}):`}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography className="row--text text-bold">{formatCurrency(beregningsData.omregnetAarsloen)} kr.</Typography>
                    {aarsloenPdfDownloadButton}
                  </Box>
                </Box>
              </>
            )}

            {/* METODE C: Måneder/Uger */}
            {beregningsData.metode === 'C' && (
              <>
                {loenperiode === LOENPERIODE.MAANED && (
                  <>
                    {/* Linje 2: Antal måneder */}
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                      <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'måned', 'måneder')}</Typography>
                    </Box>

                    {/* Linje 3: Beregnet årsløn */}
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
                    {/* Linje 2: Antal uger */}
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Antal uger i indtastede perioder:</Typography>
                      <Typography className="row--text">{formatCountWithUnit(beregningsData.antalEnheder, 'uge', 'uger')}</Typography>
                    </Box>

                    {/* Linje 3: Beregnet årsløn */}
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
                        {/* Hele kalendermåneder — vis måneds-omregning som ved månedsløn */}
                        {/* Linje 2: Antal måneder */}
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">Antal måneder i indtastede perioder:</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.antalHeleKalendermaaneder, 'måned', 'måneder')}</Typography>
                        </Box>

                        {/* Linje 3: Beregnet årsløn */}
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
                        {/* Linje 2: Hverdage i indtastede perioder */}
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{`Hverdage i beregningsperioden (${formatCountWithUnit(beregningsData.hverdageIPeriode, 'hverdag', 'hverdage')}${!fuldLoenUnderFerie && beregningsData.feriedageFraInput > 0 ? ` - ${formatCountWithUnit(beregningsData.feriedageFraInput, 'feriedag', 'feriedage')}` : ''}):`}</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.arbejdsdageIPeriode, 'hverdag', 'hverdage')}</Typography>
                        </Box>

                        {/* Linje 3: Hverdage på et år */}
                        <Box className="row--label-right-hover">
                          <Typography className="row--text">{fuldLoenUnderFerie
                            ? `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage):`
                            : `Hverdage på et år (${STANDARD_HVERDAGE_PAA_AAR} hverdage - ${beregningsData.feriedagePaaAar} ${retTilSjetteFerieuge ? 'ferie- og feriefridage' : 'feriedage'}):`
                          }</Typography>
                          <Typography className="row--text">{formatCountWithUnit(beregningsData.hverdagePaaAar, 'hverdag', 'hverdage')}</Typography>
                        </Box>

                        {/* Linje 4: Beregnet årsløn */}
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
