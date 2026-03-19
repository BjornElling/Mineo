import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { coerceToISODateString } from '../../../types/branded';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import {
  computeEetKapitaliseringCalculation,
  formatKapitaliseringsPct,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import { downloadKapitaliseringPdf } from '../../../utils/pdf/pdfService';
import EetIssuesBox from './EetIssuesBox';
import TextHoverRow from './TextHoverRow';
import PdfDownloadButton from '../../inputs/PdfDownloadButton';
import { useEetShakeFlag } from './useEetShakeFlag';
import { formatFaktor, formatJaNej, formatKr, navigationSortKey, toFieldIssue } from './eetTabSharedUtils';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  onGoToEetOplysninger: () => void;
}>;


const EetKapitaliseringTab: React.FC<Props> = ({ values, onGoToEetOplysninger }) => {
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const faellesPersondataFieldErrors = useFormFieldErrors('faellesPersondata');
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useEetShakeFlag();

  const calculationResult = React.useMemo(
    () =>
      computeEetKapitaliseringCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        skadelidteFodselsdato: values.skadelidteFodselsdato,
      }),
    [stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
      return [
        toFieldIssue('field-aarsloen-asl', faellesAarsloenFieldErrors.aslAarsloen?.message),
        toFieldIssue('field-asl-afgoerelser', eetFieldErrors.aslAfgoerelser?.message),
        toFieldIssue('field-skadelidte-fodselsdato', faellesPersondataFieldErrors.skadelidteFodselsdato?.message),
        toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
      ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    }, [
      eetFieldErrors.aslAfgoerelser?.message,
      faellesPersondataFieldErrors.skadelidteFodselsdato?.message,
      faellesAarsloenFieldErrors.aslAarsloen?.message,
      stamdataFieldErrors.skadesdato?.message,
    ]);

  const issues = React.useMemo(
    () =>
      dedupeIssuesBySeverityAndMessage([...calculationResult.issues, ...fieldIssues]).sort(
        (a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)
      ),
    [calculationResult.issues, fieldIssues]
  );

  const hasBlockingErrors = issues.some((issue) => issue.severity === 'error');
  const computation = calculationResult.computation;
  const afgoerelser = computation?.afgoerelser ?? [];

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      triggerDownloadShake();
      return;
    }
    await downloadKapitaliseringPdf({
      computation,
      koen: values.koen ?? undefined,
      settings,
      persistedStamdata: stamdata,
    });
  }, [computation, values.koen, settings, stamdata, triggerDownloadShake]);

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {!hasBlockingErrors && (
        <ContentBox className="content-box">
          <Typography className="section-header">Beregning</Typography>

          <Box className="row--label-right-hover">
            <Typography className="row--text">Download specifikation</Typography>
            <Box className="row--label-right-hover__content">
              <PdfDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
            </Box>
          </Box>
        </ContentBox>
      )}

      {!hasBlockingErrors && afgoerelser.length === 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>
          <TextHoverRow text="Der er ingen kapitaliserede afgørelser i sagen." />
        </ContentBox>
      )}

      {!hasBlockingErrors &&
        afgoerelser.map((afgoerelse) => (
          <ContentBox key={afgoerelse.rowId} className="content-box">
            <Typography className="section-header">
              Afgørelse {formatIsoDateLong(afgoerelse.afgoerelsesdato)}
            </Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregningsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatIsoDateShort(coerceToISODateString(values.beregningsdato))}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatIsoDateShort(afgoerelse.kapitaliseringsdato)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Grundydelse og regulering</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitalisering</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKapitaliseringsPct(afgoerelse.kapitaliseringspct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {buildKapitaliseringGrundydelseLabel(
                  formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
                  afgoerelse.amBidragPct
                )}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">
                  {buildKapitaliseringGrundydelseExpression(
                    formatKr(afgoerelse.grundloen, 0),
                    formatKapitaliseringsPct(afgoerelse.kapitaliseringspct),
                    afgoerelse.erstatningsniveauPct,
                    afgoerelse.amBidragPct,
                    formatKr(afgoerelse.grundydelse, 2)
                  )}
                </Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Reguleringsprocent ({formatIsoDateLong(afgoerelse.kapitaliseringsdato)})</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${formatAsAmountTrimmed(afgoerelse.reguleringsPctRounded4, 4)} %`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Årlig ydelse (${formatKr(afgoerelse.grundydelse, 2)} x ${formatAsAmountTrimmed(100 + afgoerelse.reguleringsPctRounded4, 4)} %)`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(afgoerelse.aarsydelse, 2)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsbekendtgørelse og tabel</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsbekendtgørelse</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{afgoerelse.kapitaliseringsbekendtgoerelseLabel}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Alder ved kapitalisering</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${afgoerelse.alderAar} år, ${afgoerelse.alderMaaneder} måneder`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Folkepensionsalder</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{afgoerelse.folkepensionsalderLabel}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseret pga. &lt; 2 år til folkepension?</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatJaNej(afgoerelse.kapitaliseretPgaUnderToAarTilFp)}</Typography>
              </Box>
            </Box>

            {afgoerelse.kapitaliseretPgaUnderToAarTilFp && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Særfaktor (&lt; 2 år til folkepension)</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{afgoerelse.saerfaktor === null ? '-' : formatFaktor(afgoerelse.saerfaktor)}</Typography>
                </Box>
              </Box>
            )}

            {!afgoerelse.kapitaliseretPgaUnderToAarTilFp && (
              <>
                <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitaliseringsfaktor</Typography>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Faktor måneds-afhængig?</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{afgoerelse.faktorMaanedsAfhaengig ? 'Ja' : 'Nej'}</Typography>
                  </Box>
                </Box>

                {afgoerelse.koenOpdelt && (
                  <Box className="row--label-right-hover">
                    <Typography className="row--text">Køn</Typography>
                    <Box className="row--label-right-hover__content">
                      <Typography className="row--text">{values.koen}</Typography>
                    </Box>
                  </Box>
                )}

                <Box className="row--label-right-hover">
                  <Typography className="row--text">Kapitaliseringsfaktor</Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatFaktor(afgoerelse.kapitaliseringsfaktor)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            <Typography className="row--subheading" sx={{ mt: 2 }}>Kapitalbeløb</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Beregnet kapitalbeløb (${formatKr(afgoerelse.aarsydelse, 2)} x ${formatFaktor(afgoerelse.kapitaliseringsfaktor)})`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatKr(afgoerelse.kapitalbelob, 0)}</Typography>
              </Box>
            </Box>
          </ContentBox>
        ))}
    </Box>
  );
};

export default EetKapitaliseringTab;
