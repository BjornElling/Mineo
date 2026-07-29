import React from 'react';
import { Box, Typography, MenuItem } from '@mui/material';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import PercentField from '../../inputCore/react/fields/PercentField';
import RadioField from '../../inputCore/react/fields/RadioField';
import ChoiceField from '../../inputCore/react/fields/ChoiceField';
import ToggleField from '../../inputCore/react/fields/ToggleField';
import IntegerField from '../../inputCore/react/fields/IntegerField';
import StandardLoenTable from '../tables/StandardLoenTable';
import { APP_ROUTES } from '../../config/pageNavigation';
import { aarsloenStandardLoenFieldSet } from '../../domain/aarsloen/aarsloenStandardLoenFieldSet';
import ContentBox from '../layout/ContentBox';
import { useInputEvaluation } from '../../inputCore/react/useInputEvaluation';
import { useOmregningToggle } from '../../hooks/useOmregningToggle';
import {
  aarsloenDocumentDefinition,
  shDageDocumentDefinition,
} from '../../domain/aarsloen/aarsloenDocumentDefinitions';
import { visibleDocumentFailureMessage } from '../../document/definition/react/useDocumentDownload';
import {
  useMineoDocumentOutputWithContext,
  useMineoDocumentSourceContext,
} from '../../document/runtime/react/useMineoDocumentOutput';
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
import { AARSLOEN_BEREGNING_INGEN } from '../../types/calculation';
import type { FieldRef } from '../../inputCore/fieldDescriptor';
import { resolveAarsloenIndtastetEnhedSummary } from '../../domain/aarsloen/aarsloenPeriodDisplay';
import {
  shouldShowAarsloenFerieFields,
  shouldShowAarsloenShDageFields,
  shouldWarnAarsloenFeriePct,
} from '../../domain/policies/aarsloenPolicy';
import type { StandardLoenTableHandle, StyledToggleSwitchHandle } from '../../types/handles';
import { LOEN_PAA_HELLIGDAGE, LOENPERIODE, TILLAEG_ANGIVES_SOM } from '../../types/loen';
import type { LoenPaaHelligdage, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas/enumSchemas';

// Hele siden kører nu
// på inputCore: Satser-blokken (Pass 1), løntabellen (StandardLoenTable over grid-adapteren) OG
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
// Påkrævet valg (allowEmpty=false): descriptorens værditype er ikke-optionel, men Choice-/radio-skallen
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

/**
 * Årsløn-side
 *
 * Beregner årsløn baseret på satser og indtægtsoplysninger
 */
const Aarsloen = React.memo(() => {
  const evaluation = useInputEvaluation();

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
  // reagerer på samme committed forudsætninger (gate). Togglen er et ALMINDELIGT persisteret felt gennem
  // `ToggleField` (§3.2/§3.7) — gaten leveres som dens `commit`-override, så en ugyldig aktivering afvises uden
  // at feltbindingen eller undo/redo-fokusmetadataen falder væk (R7-F02).
  const toggleRef = React.useRef<StyledToggleSwitchHandle | null>(null);

  const { omregningGate } = readerProjection;

  const { checked: omregningChecked, effectiveEnabled: omregningAktiveret, decideToggle: decideOmregningToggle } = useOmregningToggle({
    gate: omregningGate,
    tabelRef,
    toggleRef,
  });

  // Fatal-gate (§1.6/§3.9): et satsinput uden for 0–100 (eller antalFeriedage uden for 0–99) er en RØD
  // feltfejl. Projektionen kalder da IKKE motoren (`calculation === null`), så der findes intet resultat at vise —
  // en beregning på den skjulte tomværdi ville være misvisende.
  const calculation = readerProjection.calculation;
  const harFatalBeregningsFejl = calculation === null || calculation.harFatalBeregningsFejl;

  // Beregningsfelterne læses kun når der ER et resultat; ellers viser siden '—' (harFatalBeregningsFejl).
  const periodeData = calculation?.periodeData ?? null;
  const shDageAntal = calculation?.shDageAntal ?? null;
  const beregnetAarsloen = calculation?.beregnetAarsloen ?? 0;
  // `metode: 'ingen'` er modellens kanoniske "ingen beregning" — samme variant motoren selv returnerer, når
  // input ikke rækker til en metode. Ingen opdigtede tal.
  const beregningsData = calculation?.beregningsData ?? AARSLOEN_BEREGNING_INGEN;
  const fejlmeddelelser = calculation?.fejlmeddelelser ?? [];
  const beregningsFejl = calculation?.beregningsFejl ?? [];


  // Dokument-download (Fase 5). Begge outputs deler ÉN kildekontekst, så årsløns-projektionen kun
  // bygges én gang pr. revision, uanset at siden tegner to knapper. Hele preflighten — settle, frisk
  // capture, token-lighed, gate — ejes af definitionerne; her er kun blokerings-FEEDBACKEN tilbage
  // (shake + flash af den fejlende celle), som er ren præsentation og forskellig pr. side.
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
    }, 500);
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

  // De to outputs deler fejlboksen, som de gjorde før Fase 5. Gate-blokeringer vises ikke her —
  // knappernes tooltip bærer årsagen, og en blokeret årsløn-download besvares med shake + celle-flash.
  const downloadErrorMessage =
    visibleDocumentFailureMessage(aarsloenDownload) ?? visibleDocumentFailureMessage(shDageDownload);

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
      disabled={!aarsloenDownload.canDownload}
      disabledReason={aarsloenDownload.disabledReason}
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
            <RadioField<Loenperiode>
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
            <ChoiceField<TillaegAngivesSom>
              field={tillaegAngivesSomRef}
              location={loc('tillaegAngivesSom')}
              name="tillaegAngivesSom"
              width={185}
              allowEmpty={false}
            >
              <MenuItem value={TILLAEG_ANGIVES_SOM.PROCENT}>Procent</MenuItem>
              <MenuItem value={TILLAEG_ANGIVES_SOM.BELOEB}>Beløb</MenuItem>
            </ChoiceField>
          </Box>
        </Box>

        {tillaegAngivesSom !== TILLAEG_ANGIVES_SOM.BELOEB && (
          <>
            <Box className="row--label-right-hover">
              <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>Feriegodtgørelse/-tillæg:</Typography>
                  <PercentField field={feriePctRef} location={loc('feriePct')} name="feriePct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '60px' }}>Fritvalg:</Typography>
                  <PercentField field={fritvalgPctRef} location={loc('fritvalgPct')} name="fritvalgPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '140px' }}>SH/SO-sats:</Typography>
                  <PercentField field={shSoPctRef} location={loc('shSoPct')} name="shSoPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Box sx={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '160px' }}>Store Bededagstillæg:</Typography>
                  <PercentField field={storeBededagPctRef} location={loc('storeBededagPct')} name="storeBededagPct" placeholder="0" sx={{ width: '100px' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography className="row--text" sx={{ minWidth: '190px' }}>Arbejdsgivers pensionsbidrag:</Typography>
                  <PercentField field={pensionPctRef} location={loc('pensionPct')} name="pensionPct" placeholder="0" sx={{ width: '100px' }} />
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
            <ToggleField
              field={omregningTilFuldtAarRef}
              location={loc('omregningTilFuldtAar')}
              name="omregningTilFuldtAar"
              ref={toggleRef}
              checkedOverride={omregningChecked}
              commit={decideOmregningToggle}
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
              <ToggleField
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
                <ToggleField
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
                <IntegerField
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
              <ChoiceField<LoenPaaHelligdage>
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
              </ChoiceField>
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
                    disabled={!shDageDownload.canDownload}
                    disabledReason={shDageDownload.disabledReason}
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
