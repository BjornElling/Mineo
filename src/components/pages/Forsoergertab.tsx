import React from 'react';
import { Box, MenuItem, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DateField from '../../inputCore/react/fields/DateField';
import ChoiceField from '../../inputCore/react/fields/ChoiceField';
import IntegerField from '../../inputCore/react/fields/IntegerField';
import AmountField from '../../inputCore/react/fields/AmountField';
import InsertTodayDateButton from '../inputs/InsertTodayDateButton';
import ContentBox from '../layout/ContentBox';
import { APP_ROUTES } from '../../config/pageNavigation';
import { type Koen } from '../../schemas/formSchemas';
import { isoToDanish } from '../../types/branded';
import { formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit, formatKr } from '../../utils/formatUtils';
import DocumentDownloadButton from '../inputs/DocumentDownloadButton';
import { downloadForsoergertabDokument } from '../../document/service/documentService';
import { buildAldersreduktionFormelTekst } from '../../domain/erhvervsevnetab/eetAldersreduktionFormel';
import StandardLooseTable from '../tables/StandardLooseTable';
import { toKroner } from '../../domain/money/money';
import { buildForsoergertabReaderProjection } from '../../domain/forsoergertab/forsoergertabReaderProjection';
import { evaluateForsoergertabDownloadGate } from '../../domain/forsoergertab/forsoergertabDownloadGate';
import { projectStamdataForDocument } from '../../domain/stamdata/stamdataDocumentProjection';
import {
  forsoergertabBeregningsdatoField,
  forsoergertabEfterladteFodselsdatoField,
  forsoergertabKoenField,
  forsoergertabTilkendtForPeriodeAarField,
  forsoergertabVirkningsdatoField,
} from '../../inputCore/catalog/forsoergertabDescriptors';
import {
  faellesAarsloenAslAarsloenField,
  faellesAarsloenEalAarsloenField,
} from '../../inputCore/catalog/faellesAarsloenDescriptors';
import { stamdataSkadelidteFodselsdatoField } from '../../inputCore/catalog/stamdataDescriptors';
import { useInputEvaluation, useCriticalInputActions } from '../../inputCore/react/useInputEvaluation';
import { useFieldEditor } from '../../inputCore/react/useFieldEditor';
import { captureProductionEvaluationSource } from '../../inputCore/react/productionInputRuntime';
import { sourceTokensEqual } from '../../inputCore/evaluationSource';

// Greenfield-migreret Forsørgertab (§2.4 formularrækkefølge trin 6 / Fase 3 Forsørgertab-slice). Hele siden kører
// nu på greenfield-inputCore: de fem forsoergertab-felter + de delte ASL/EAL-årsløn skriver/læser gennem den
// offentlige `InputReader` + den ene write-grænse (ingen `usePersistedForm`/`setFieldValue`); de tværsektionelle
// stamdata-datoer læses gennem samme reader (ingen rå `usePersistedSectionSelector`/`useFormFieldErrors`). Den ENE
// reader-afledte projektion (`buildForsoergertabReaderProjection`) driver både beregningsvisning og download-gaten;
// den kører `computeForsoergertabSnapshot` UÆNDRET (§5.4 — ingen talændring). Format-/bounds-feltfejl vises inline
// på felterne fra det tokenbundne issue-snapshot; domæne-/manglende-felt-beskeder vises i contentboxen og
// download-gatens tooltip (brugerbeslutning 2026-07-18 — samme mønster som Varige mén/Renteberegning, §1.7/§1.8).

const efterladteFodselsdatoRef = forsoergertabEfterladteFodselsdatoField.bind();
const beregningsdatoRef = forsoergertabBeregningsdatoField.bind();
const virkningsdatoRef = forsoergertabVirkningsdatoField.bind();
const koenRef = forsoergertabKoenField.bind();
const tilkendtForPeriodeAarRef = forsoergertabTilkendtForPeriodeAarField.bind();
const aslAarsloenRef = faellesAarsloenAslAarsloenField.bind();
const ealAarsloenRef = faellesAarsloenEalAarsloenField.bind();
const skadelidteFodselsdatoRef = stamdataSkadelidteFodselsdatoField.bind();

// route er eksplicit navigation-metadata (§3.7); Forsørgertab er en side uden faner (tabKey: null). De to
// faellesAarsloen-lokationer (aslAarsloen/ealAarsloen) deler feltadresse med Erhvervsevnetab, men MED route
// `/forsoergertab` — det er route (ikke feltadresse/section) der disambiguerer, hvilken side undo/redo lander på.
const BEREGNINGSDATO_LOCATION = { locationId: 'forsoergertab:beregningsdato', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const VIRKNINGSDATO_LOCATION = { locationId: 'forsoergertab:virkningsdato', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const EFTERLADTE_FODSELSDATO_LOCATION = { locationId: 'forsoergertab:efterladteFodselsdato', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const KOEN_LOCATION = { locationId: 'forsoergertab:koen', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const TILKENDT_LOCATION = { locationId: 'forsoergertab:tilkendtForPeriodeAar', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const ASL_AARSLOEN_LOCATION = { locationId: 'forsoergertab:aslAarsloen', route: APP_ROUTES.forsoergertab, tabKey: null } as const;
const EAL_AARSLOEN_LOCATION = { locationId: 'forsoergertab:ealAarsloen', route: APP_ROUTES.forsoergertab, tabKey: null } as const;

const FORSOERGERTAB_DOCUMENT_CONSUMER_ID = 'document.forsoergertab';

const Forsoergertab = React.memo(() => {
  const navigate = useNavigate();
  const evaluation = useInputEvaluation();
  const criticalActions = useCriticalInputActions();

  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);
  const beregningsdatoController = useFieldEditor(beregningsdatoRef, BEREGNINGSDATO_LOCATION);

  const [pdfErrorMessage, setPdfErrorMessage] = React.useState<string | null>(null);

  // Den ENE reader-afledte projektion (§3.4/§5.4/§1.10): beregningsvisning og download-gate deler præcis samme
  // sandhed. Snapshottet ejer den dependency-specifikke panel-/gate-logik (§1.10) — det gates derfor ikke bag en
  // global blocked-tilstand: en fejl på fx virkningsdato blokerer ASL + download, men bevarer EAL-panelet (som legacy).
  const projection = React.useMemo(
    () => buildForsoergertabReaderProjection(evaluation.reader),
    [evaluation]
  );
  const snapshot = projection.snapshot;
  const downloadGate = React.useMemo(
    () => evaluateForsoergertabDownloadGate(projection),
    [projection]
  );

  // Skadelidtes fødselsdato læses gennem readeren; en aktiv rød feltfejl skjuler værdien (`error`).
  const skadelidteFodselsdatoRead = evaluation.reader.read(skadelidteFodselsdatoRef);
  const skadelidteFodselsdato = skadelidteFodselsdatoRead.status === 'usable' ? skadelidteFodselsdatoRead.value : undefined;
  const skadelidteFodselsdatoError =
    skadelidteFodselsdatoRead.status === 'error' ? skadelidteFodselsdatoRead.issue.message : undefined;

  const result = snapshot.calculation.result;
  const ealComputation = snapshot.calculation.ealComputation;
  const aslComputation = snapshot.calculation.aslComputation;
  const foersoergertabEalMinSatsOre = snapshot.calculation.foersoergertabEalMinSatsOre;
  const foersoergertabForhoejtetTilMin = snapshot.calculation.foersoergertabForhoejtetTilMin;
  const visKoenValg = snapshot.visKoenValg;
  const canShowEal = snapshot.canShowEal;
  const canShowAsl = snapshot.canShowAsl;
  const canShowResult = snapshot.canShowResult;
  const koenFieldHasError = snapshot.fieldUi.koen.hasError;

  const handlePdfDownload = React.useCallback(async () => {
    // §1.4/§3.9: settle en evt. åben editor, læs derefter et frisk kildesnapshot, og genkør projektionen/gaten
    // mod det. Handlingen afbrydes, hvis input/settings flyttede under settle (stale token).
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const source = captureProductionEvaluationSource();
    if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) return;

    const freshProjection = buildForsoergertabReaderProjection(source.evaluation.reader);
    const freshGate = evaluateForsoergertabDownloadGate(freshProjection);
    if (!freshGate.canDownload) {
      setPdfErrorMessage(freshGate.reasons[0]?.message ?? null);
      return;
    }

    const freshStamdata = projectStamdataForDocument(source.evaluation.reader, FORSOERGERTAB_DOCUMENT_CONSUMER_ID);
    if (freshStamdata.status !== 'ready') return;

    const result = await downloadForsoergertabDokument({
      pdfParams: freshProjection.snapshot.pdfProjection,
      settings: source.settings,
      persistedStamdata: freshStamdata.value,
      isSourceCurrent: source.isSourceCurrent,
    });
    setPdfErrorMessage(result.success ? null : result.error);
  }, [criticalActions]);

  return (
    <Box>
      <Typography className="page-title">Forsørgertab</Typography>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <DateField
              field={beregningsdatoRef}
              location={BEREGNINGSDATO_LOCATION}
              name="beregningsdato"
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                beregningsdatoController.commitImmediate(today);
              }}
              focusRef={beregningsdatoInputRef}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download specifikation</Typography>
          <Box className="row--label-right-hover__content" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!downloadGate.canDownload && (
              <Tooltip title={downloadGate.reasons[0]?.message ?? ''} arrow>
                <Typography className="row--text" color="text.disabled">
                  {downloadGate.reasons[0]?.message ?? ''}
                </Typography>
              </Tooltip>
            )}
            <DocumentDownloadButton
              onClick={() => void handlePdfDownload()}
              disabled={!downloadGate.canDownload}
              disabledReason={downloadGate.reasons[0]?.message ?? undefined}
              dataTestId="forsoergertab-download"
            />
          </Box>
        </Box>

        {pdfErrorMessage && (
          <Box className="row--label-right-hover">
            <Typography className="row--text" sx={{ color: 'error.main' }}>
              {pdfErrorMessage}
            </Typography>
            <Box />
          </Box>
        )}
      </ContentBox>

      <ContentBox className="content-box" data-section-id="forsoergertab-beregning">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skadelidtes fødselsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
            {skadelidteFodselsdato && !skadelidteFodselsdatoError ? (
              <Typography className="row--text">{isoToDanish(skadelidteFodselsdato)}</Typography>
            ) : (
              <Typography className="row--text" color="text.secondary">
                {skadelidteFodselsdatoError ?? (
                  <>
                    Mangler (angiv i&nbsp; {' '}
                    <Typography
                      component="span"
                      className="icon-text-link"
                      color="inherit"
                      onClick={() => navigate('/stamdata')}
                      sx={{ cursor: 'pointer' }}
                    >
                      Stamdata
                    </Typography>
                    )
                  </>
                )}
              </Typography>
            )}
          </Box>
        </Box>

        {(visKoenValg || koenFieldHasError) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              <ChoiceField<Koen>
                field={koenRef}
                location={KOEN_LOCATION}
                name="koen"
                placeholder="Vælg køn"
                width={130}
              >
                <MenuItem value={'Mand' satisfies Koen}>Mand</MenuItem>
                <MenuItem value={'Kvinde' satisfies Koen}>Kvinde</MenuItem>
              </ChoiceField>
            </Box>
          </Box>
        )}

        <Typography className="row--subheading">ASL-ydelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skadelidtes årsløn (efter ASL)</Typography>
          <Box className="row--label-right-hover__content">
            <AmountField
              field={aslAarsloenRef}
              location={ASL_AARSLOEN_LOCATION}
              name="aslAarsloen"
              allowDecimals={false}
              width={140}
              placeholder="0"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Startdato for ASL-ydelse</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={virkningsdatoRef}
              location={VIRKNINGSDATO_LOCATION}
              name="virkningsdato"
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Tilkendt for periode</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <IntegerField
              field={tilkendtForPeriodeAarRef}
              location={TILKENDT_LOCATION}
              name="tilkendtForPeriodeAar"
              width={80}
            />
            <Typography className="row--text">år</Typography>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Efterladte ægtefælle/samlevers fødselsdato</Typography>
          <Box className="row--label-right-hover__content">
            <DateField
              field={efterladteFodselsdatoRef}
              location={EFTERLADTE_FODSELSDATO_LOCATION}
              name="efterladteFodselsdato"
            />
          </Box>
        </Box>

        <Typography className="row--subheading">EAL-ydelse</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skadelidtes årsløn (efter EAL)</Typography>
          <Box className="row--label-right-hover__content">
            <AmountField
              field={ealAarsloenRef}
              location={EAL_AARSLOEN_LOCATION}
              name="ealAarsloen"
              allowDecimals={false}
              width={140}
              placeholder="0"
            />
          </Box>
        </Box>
      </ContentBox>

      {canShowResult && result && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregnet forsørgertab</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">EAL-krav</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(result.ealKrav)}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Løbende ydelser (efter ASL)</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{`- ${formatKr(result.aslLobendeYdelserTotal)}`}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Kapitalbeløb (efter ASL)</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{`- ${formatKr(result.aslKapitalbelob)}`}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Forsørgertabserstatning</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(result.nettokrav)}</Typography>
            </Box>
          </Box>
        </ContentBox>
      )}

      {canShowEal && ealComputation && (
        <ContentBox className="content-box" data-section-id="forsoergertab-eal">
          <Typography className="section-header">EAL-krav</Typography>

          <Typography className="row--subheading">Årsløn</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Skadelidtes årsløn på skadestidspunktet</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(toKroner(ealComputation.aarsloenOre))}</Typography>
            </Box>
          </Box>

          {ealComputation.reguleringsaar.length > 0 && (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">
                  {`Regulering fra skadesår ${ealComputation.skadesaar} til beregningsår ${ealComputation.beregningsaar}`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{`+ ${formatAsAmountTrimmed(ealComputation.reguleringsPctRounded4, 4)} %`}</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">
                  {`${formatKr(toKroner(ealComputation.aarsloenOre))} x (100 % + ${formatAsAmountTrimmed(ealComputation.reguleringsPctRounded4, 4)} %) (afrundet) =`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{formatKr(toKroner(ealComputation.reguleretAarsloenOre))}</Typography>
                </Box>
              </Box>
            </>
          )}

          <Typography className="row--subheading">Erhvervsevnetab</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Erstatningsprocent (jf. erstatningsansvarslovens § 13)</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">30 %</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Kapitaliseringsfaktor</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{ealComputation.kapitaliseringsfaktor}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`Beregnet forsørgertab (${formatKr(toKroner(ealComputation.reguleretAarsloenOre))} x ${ealComputation.kapitaliseringsfaktor} x 30 %) =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(toKroner(ealComputation.eetBeregnetOre))}</Typography>
            </Box>
          </Box>

          {foersoergertabEalMinSatsOre !== null && (
            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Mindste erstatningsniveau i beregningsåret ${ealComputation.beregningsaar}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(foersoergertabEalMinSatsOre))}</Typography>
              </Box>
            </Box>
          )}

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {foersoergertabForhoejtetTilMin
                ? 'Det beregnede forsørgertab skal forhøjes til minimum, dvs. udgør'
                : 'Det beregnede forsørgertab skal ikke forhøjes, dvs. udgør'}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(toKroner(ealComputation.eetAnvendtOre))}</Typography>
            </Box>
          </Box>

          <Typography className="row--subheading">Aldersreduktion</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Skadelidtes alder på skadestidspunkt</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatCountWithUnit(ealComputation.alderVedSkade, 'år', 'år')}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`Aldersreduktion ${buildAldersreduktionFormelTekst(ealComputation.alderVedSkade)}`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{`${ealComputation.aldersreduktionPct} %`}</Typography>
            </Box>
          </Box>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`${formatKr(toKroner(ealComputation.eetAnvendtOre))} x (- ${ealComputation.aldersreduktionPct} %) =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{`- ${formatKr(toKroner(ealComputation.aldersreduktionBeloebOre))}`}</Typography>
            </Box>
          </Box>

          <Typography className="row--subheading">Beregnet EAL-krav</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`${formatKr(toKroner(ealComputation.eetAnvendtOre))} - ${formatKr(toKroner(ealComputation.aldersreduktionBeloebOre))} =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(toKroner(ealComputation.ealKravOre))}</Typography>
            </Box>
          </Box>
        </ContentBox>
      )}

      {canShowAsl && aslComputation && (
        <ContentBox className="content-box" data-section-id="forsoergertab-asl">
          <Typography className="section-header">ASL-ydelser</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Årsløn efter ASL</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(aslComputation.aslAarsloen)}</Typography>
            </Box>
          </Box>

          <Typography className="row--subheading">Løbende ydelse</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Ydelsen udgør 30 % af afdødes årsløn, jf. ASL § 30, opreguleret til udbetalingsåret.</Typography>
            <Box className="row--label-right-hover__content" />
          </Box>

          {aslComputation.lobendeYdelser.length > 0 ? (
            <>
              <StandardLooseTable
                sx={{
                  mt: 1,
                  mb: 1,
                  tableLayout: 'fixed',
                  '& .MuiTableCell-root': { verticalAlign: 'middle' },
                  '& thead th': { textAlign: 'right' },
                  '& thead th:first-of-type': { textAlign: 'left' },
                  '& tbody td': { textAlign: 'right' },
                  '& tbody td:first-of-type': { textAlign: 'left' },
                }}
              >
                <colgroup>
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '90px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '120px' }} />
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableCell>Fra-dato</TableCell>
                    <TableCell>Til-dato</TableCell>
                    <TableCell>Måneder</TableCell>
                    <TableCell>Månedlig ydelse</TableCell>
                    <TableCell>Ydelser i perioden</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {aslComputation.lobendeYdelser.map((raekke) => (
                    <TableRow key={raekke.fraDato}>
                      <TableCell>{isoToDanish(raekke.fraDato)}</TableCell>
                      <TableCell>{isoToDanish(raekke.tilDato)}</TableCell>
                      <TableCell>{formatAsAmount(raekke.maaneder, 4)}</TableCell>
                      <TableCell>{formatKr(raekke.maanedligYdelse, 0)}</TableCell>
                      <TableCell>{formatKr(raekke.ydelseIAlt, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </StandardLooseTable>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Løbende ydelser i alt</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text text-bold">{formatKr(aslComputation.aslLobendeYdelserTotal)}</Typography>
                </Box>
              </Box>
            </>
          ) : (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Løbende ydelser</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">Ingen</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Løbende ydelser i alt</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text text-bold">{formatKr(0)}</Typography>
                </Box>
              </Box>
            </>
          )}

          <Typography className="row--subheading">Beregnet kapitalbeløb</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Der foretages proformakapitalisering af resterende løbende ydelser</Typography>
            <Box className="row--label-right-hover__content" />
          </Box>

          {aslComputation.resterendeMaanederTotal === 0 ? (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">Resterende periode</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">Ingen</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Kapitalbeløb</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text text-bold">{formatKr(0)}</Typography>
                </Box>
              </Box>
            </>
          ) : (
            <>
              <Box className="row--label-right-hover">
                <Typography className="row--text">
                  {`Årlig ydelse i ${aslComputation.beregningsaar}-værdi: 30 % x ${formatKr(aslComputation.benyttetAarsloen)} × (${formatAsAmountTrimmed(aslComputation.aarsloenMaxBeregningsaar, 0)} / ${formatAsAmountTrimmed(aslComputation.aarsloenMaxSkadesaar, 0)}) =`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{formatKr(aslComputation.opreguleretAarligYdelse, 2)}</Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Resterende periode</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">
                    {`${formatCountWithUnit(aslComputation.resterendeAar, 'år', 'år')} og ${formatCountWithUnit(aslComputation.resterendeMaaneder, 'måned', 'måneder')}`}
                  </Typography>
                </Box>
              </Box>

              <Box className="row--label-right-hover">
                <Typography className="row--text">Efterladtes alder på beregningsdatoen</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{formatCountWithUnit(aslComputation.alderHeleAar, 'år', 'år')}</Typography>
                </Box>
              </Box>

              {aslComputation.harNaaetFolkepensionsalder ? (
                <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Folkepensionsalder</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{aslComputation.folkepensionsalderLabel}</Typography>
                    </Box>
                  </Box>

                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Værdien af løbende ydelser efter folkepensionsalderen udgør</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text text-bold">{formatKr(0)}</Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <>
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">
                        {aslComputation.kapitaliseringsTabel
                          ? `Vejl. ${aslComputation.kapitaliseringsbekendtgoerelseId}, tabel ${aslComputation.kapitaliseringsTabel}`
                          : `Vejl. ${aslComputation.kapitaliseringsbekendtgoerelseId}`}
                      </Typography>
                    </Box>
                  </Box>

                  {aslComputation.kapitaliseringsTabelKoensopdelt && aslComputation.koen && (
                    <Box className="row--label-right-hover">
                      <Typography className="row--text">Køn</Typography>
                      <Box className="row--label-right-hover__content">
                        <Typography className="row--text">{aslComputation.koen}</Typography>
                      </Box>
                    </Box>
                  )}

                  {aslComputation.kapitalfaktor !== null && (
                    <>
                      <Box className="row--label-right-hover">
                        <Typography className="row--text">Kapitalfaktor</Typography>
                        <Box className="row--label-right-hover__content">
                          <Typography className="row--text">{formatAsAmountTrimmed(aslComputation.kapitalfaktor, 3)}</Typography>
                        </Box>
                      </Box>

                      <Box className="row--label-right-hover">
                        <Typography className="row--text">
                          {`Beregnet kapitalbeløb (${formatKr(aslComputation.opreguleretAarligYdelse, 2)} x ${formatAsAmountTrimmed(aslComputation.kapitalfaktor, 3)})`}
                        </Typography>
                        <Box className="row--label-right-hover__content">
                          <Typography className="row--text text-bold">{formatKr(aslComputation.kapitalbelob)}</Typography>
                        </Box>
                      </Box>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </ContentBox>
      )}
    </Box>
  );
});

Forsoergertab.displayName = 'Forsoergertab';

export default Forsoergertab;
