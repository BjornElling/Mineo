import React from 'react';
import { Box, MenuItem, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import StyledDateField from '../inputs/StyledDateField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledIntegerField from '../inputs/StyledIntegerField';
import InsertTodayDateButton from '../inputs/InsertTodayDateButton';
import ContentBox from '../layout/ContentBox';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { usePersistedForm } from '../../hooks/usePersistedForm';
import { usePersistedSectionSelector } from '../../hooks/useFormPersistenceSelectors';
import { useFormFieldErrorReporter, useFormFieldErrors } from '../../hooks/useFormFieldErrors';
import { useAslAarsloenRuleReporter } from '../../hooks/useAslAarsloenRuleReporter';
import { faellesAarsloenSchema, forsoergertabSchema, koenEnum } from '../../schemas/formSchemas';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import { FORSOERGERTAB_INITIAL_VALUES } from '../../domain/forsoergertab/forsoergertabInitialValues';
import { isoToDanish } from '../../types/branded';
import { formatAsAmount, formatAsAmountTrimmed, formatCountWithUnit, formatKr } from '../../utils/formatUtils';
import PdfDownloadButton from '../inputs/PdfDownloadButton';
import AarsloenAmountFieldRow from '../inputs/AarsloenAmountFieldRow';
import { useAppSettings } from '../../contexts/useAppSettings';
import { downloadForsoergertabPdf } from '../../pdf/infrastructure/pdfService';
import { buildAldersreduktionFormelTekst } from '../../domain/erhvervsevnetab/eetAldersreduktionFormel';
import StandardLooseTable from '../tables/StandardLooseTable';
import { computeForsoergertabSnapshot } from '../../domain/forsoergertab/forsoergertabSnapshot';

const Forsoergertab = React.memo(() => {
  const navigate = useNavigate();
  const { values, setFieldValue } = usePersistedForm(
    forsoergertabSchema,
    'forsoergertab',
    FORSOERGERTAB_INITIAL_VALUES
  );
  const { values: faellesAarsloenValues, setFieldValue: setFaellesAarsloenFieldValue } = usePersistedForm(
    faellesAarsloenSchema,
    'faellesAarsloen',
    FAELLES_AARSLOEN_INITIAL_VALUES
  );
  const stamdata = usePersistedSectionSelector('stamdata');
  const { settings } = useAppSettings();

  const forsoergertabFieldErrors = useFormFieldErrors('forsoergertab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');

  const reportBeregningsdatoError = useFormFieldErrorReporter('forsoergertab', 'beregningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportEfterladteFodselsdatoError = useFormFieldErrorReporter('forsoergertab', 'efterladteFodselsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportVirkningsdatoError = useFormFieldErrorReporter('forsoergertab', 'virkningsdato', {
    severity: 'error',
    source: 'input',
  });
  const reportTilkendtForPeriodeError = useFormFieldErrorReporter('forsoergertab', 'tilkendtForPeriodeAar', {
    severity: 'error',
    source: 'input',
  });
  const reportAslAarsloenError = useFormFieldErrorReporter('faellesAarsloen', 'aslAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const reportEalAarsloenError = useFormFieldErrorReporter('faellesAarsloen', 'ealAarsloen', {
    severity: 'error',
    source: 'input',
  });
  const beregningsdatoInputRef = React.useRef<HTMLInputElement>(null);

  useAslAarsloenRuleReporter(faellesAarsloenValues.aslAarsloen, stamdata?.skadedato);

  const snapshot = React.useMemo(
    () =>
      computeForsoergertabSnapshot({
        values,
        faellesAarsloen: faellesAarsloenValues,
        stamdata,
        fieldErrors: {
          forsoergertab: forsoergertabFieldErrors,
          faellesAarsloen: faellesAarsloenFieldErrors,
          stamdata: stamdataFieldErrors,
        },
      }),
    [faellesAarsloenFieldErrors, faellesAarsloenValues, forsoergertabFieldErrors, stamdata, stamdataFieldErrors, values]
  );

  const result = snapshot.calculation.result;
  const ealComputation = snapshot.calculation.ealComputation;
  const aslComputation = snapshot.calculation.aslComputation;
  const foersoergertabEalMinSats = snapshot.calculation.foersoergertabEalMinSats;
  const foersoergertabForhoejtetTilMin = snapshot.calculation.foersoergertabForhoejtetTilMin;

  const handlePdfDownload = React.useCallback(async () => {
    await downloadForsoergertabPdf({
      pdfParams: snapshot.pdfProjection,
      settings,
      persistedStamdata: stamdata,
    });
  }, [settings, snapshot.pdfProjection, stamdata]);

  return (
    <Box>
      <Typography className="page-title">Forsørgertab</Typography>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregning</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Beregningsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledDateField
              name="beregningsdato"
              value={values.beregningsdato || undefined}
              onCommit={(event) => setFieldValue('beregningsdato', event.target.value)}
              minDate={snapshot.inputBounds.beregningsdatoMin}
              maxDate={dateRanges_forsoergertab.beregningsdato.max}
              specialRangeErrors={{ maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Beregningsdato' }}
              error={snapshot.fieldUi.beregningsdato.hasError}
              helperText={snapshot.fieldUi.beregningsdato.helperText}
              onFieldError={reportBeregningsdatoError}
              inputRef={beregningsdatoInputRef}
            />
            <InsertTodayDateButton
              onCommit={(today) => {
                setFieldValue('beregningsdato', today);
              }}
              focusRef={beregningsdatoInputRef}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Download specifikation</Typography>
          <Box className="row--label-right-hover__content">
            <PdfDownloadButton onClick={handlePdfDownload} disabled={!snapshot.canDownloadPdf} />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box" data-section-id="forsoergertab-beregning">
        <Typography className="section-header">Grundlæggende oplysninger</Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Skadelidtes fødselsdato</Typography>
          <Box className="row--label-right-hover__content" sx={{ justifyContent: 'flex-end' }}>
            {stamdata?.skadelidteFodselsdato && !snapshot.fieldUi.skadelidteFodselsdato.hasError ? (
              <Typography className="row--text">{stamdata?.skadelidteFodselsdato ? isoToDanish(stamdata.skadelidteFodselsdato) : ''}</Typography>
            ) : (
              <Typography
                component="button"
                type="button"
                className="row--text icon-text-link"
                onClick={() => navigate('/stamdata')}
                sx={{ cursor: 'pointer', border: 0, background: 'transparent', p: 0, m: 0, font: 'inherit' }}
              >
                {stamdataFieldErrors.skadelidteFodselsdato?.message ?? 'Mangler (angiv i Stamdata)'}
              </Typography>
            )}
          </Box>
        </Box>

        {(snapshot.visKoenValg || snapshot.fieldUi.koen.hasError) && (
          <Box className="row--label-right-hover">
            <Typography className="row--text">Køn</Typography>
            <Box className="row--label-right-hover__content">
              <StyledDropdown
                name="koen"
                value={values.koen}
                onChange={(event) => {
                  const parsed = koenEnum.safeParse(event.target.value);
                  setFieldValue('koen', parsed.success ? parsed.data : undefined);
                }}
                placeholder="Vælg køn"
                width={130}
                error={snapshot.fieldUi.koen.hasError}
                helperText={snapshot.fieldUi.koen.helperText}
              >
                <MenuItem value="Mand">Mand</MenuItem>
                <MenuItem value="Kvinde">Kvinde</MenuItem>
              </StyledDropdown>
            </Box>
          </Box>
        )}

        <Typography className="row--subheading">ASL-ydelse</Typography>

        <AarsloenAmountFieldRow
          label="Skadelidtes årsløn (efter ASL)"
          name="aslAarsloen"
          value={faellesAarsloenValues.aslAarsloen}
          onCommit={(event) => setFaellesAarsloenFieldValue('aslAarsloen', event.target.value)}
          errorMessage={
            snapshot.fieldUi.aslAarsloen.helperText
          }
          onFieldError={reportAslAarsloenError}
        />

        <Box className="row--label-right-hover">
          <Typography className="row--text">Startdato for ASL-ydelse</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="virkningsdato"
              value={values.virkningsdato || undefined}
              onCommit={(event) => setFieldValue('virkningsdato', event.target.value)}
              minDate={snapshot.inputBounds.skadedatoMin}
              maxDate={snapshot.inputBounds.virkningsdatoMax}
              specialRangeErrors={{ maxBoundKind: 'dataCoverageMax', maxBoundFieldLabel: 'Virkningsdato' }}
              error={snapshot.fieldUi.virkningsdato.hasError}
              helperText={snapshot.fieldUi.virkningsdato.helperText}
              onFieldError={reportVirkningsdatoError}
            />
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Tilkendt for periode</Typography>
          <Box className="row--label-right-hover__content" sx={{ gap: 1 }}>
            <StyledIntegerField
              name="tilkendtForPeriodeAar"
              value={values.tilkendtForPeriodeAar}
              onCommit={(event) => setFieldValue('tilkendtForPeriodeAar', event.target.value)}
              minValue={1}
              maxValue={10}
              allowNegative={false}
              width={80}
              error={snapshot.fieldUi.tilkendtForPeriodeAar.hasError}
              helperText={snapshot.fieldUi.tilkendtForPeriodeAar.helperText}
              onFieldError={reportTilkendtForPeriodeError}
            />
            <Typography className="row--text">år</Typography>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">Efterladte ægtefælle/samlevers fødselsdato</Typography>
          <Box className="row--label-right-hover__content">
            <StyledDateField
              name="efterladteFodselsdato"
              value={values.efterladteFodselsdato || undefined}
              onCommit={(event) => setFieldValue('efterladteFodselsdato', event.target.value)}
              minDate={dateRanges_forsoergertab.efterladteFodselsdato.min}
              maxDate={dateRanges_forsoergertab.efterladteFodselsdato.max}
              error={snapshot.fieldUi.efterladteFodselsdato.hasError}
              helperText={snapshot.fieldUi.efterladteFodselsdato.helperText}
              onFieldError={reportEfterladteFodselsdatoError}
            />
          </Box>
        </Box>

        <Typography className="row--subheading">EAL-ydelse</Typography>

        <AarsloenAmountFieldRow
          label="Skadelidtes årsløn (efter EAL)"
          name="ealAarsloen"
          value={faellesAarsloenValues.ealAarsloen}
          onCommit={(event) => setFaellesAarsloenFieldValue('ealAarsloen', event.target.value)}
          errorMessage={
            snapshot.fieldUi.ealAarsloen.helperText
          }
          onFieldError={reportEalAarsloenError}
        />
      </ContentBox>

      {snapshot.canShowResult && result && (
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

      {snapshot.canShowEal && ealComputation && (
        <ContentBox className="content-box" data-section-id="forsoergertab-eal">
          <Typography className="section-header">EAL-krav</Typography>

          <Typography className="row--subheading">Årsløn</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Skadelidtes årsløn på skadestidspunktet</Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(ealComputation.aarsloen)}</Typography>
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
                  {`${formatKr(ealComputation.aarsloen)} x (100 % + ${formatAsAmountTrimmed(ealComputation.reguleringsPctRounded4, 4)} %) (afrundet) =`}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{formatKr(ealComputation.reguleretAarsloen)}</Typography>
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
              {`Beregnet forsørgertab (${formatKr(ealComputation.reguleretAarsloen)} x ${ealComputation.kapitaliseringsfaktor} x 30 %) =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{formatKr(ealComputation.eetBeregnet)}</Typography>
            </Box>
          </Box>

          {foersoergertabEalMinSats !== null && (
            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Mindste erstatningsniveau i beregningsåret ${ealComputation.beregningsaar}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(foersoergertabEalMinSats)}</Typography>
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
              <Typography className="row--text">{formatKr(ealComputation.eetAnvendt)}</Typography>
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
              {`${formatKr(ealComputation.eetAnvendt)} x (- ${ealComputation.aldersreduktionPct} %) =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text">{`- ${formatKr(ealComputation.aldersreduktionBeloeb)}`}</Typography>
            </Box>
          </Box>

          <Typography className="row--subheading">Beregnet EAL-krav</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`${formatKr(ealComputation.eetAnvendt)} - ${formatKr(ealComputation.aldersreduktionBeloeb)} =`}
            </Typography>
            <Box className="row--label-right-hover__content">
              <Typography className="row--text text-bold">{formatKr(ealComputation.ealKrav)}</Typography>
            </Box>
          </Box>
        </ContentBox>
      )}

      {snapshot.canShowAsl && aslComputation && (
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
