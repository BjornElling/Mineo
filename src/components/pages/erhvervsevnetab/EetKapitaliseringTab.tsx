import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabComposedValues, StamdataValues } from '../../../schemas/formSchemas';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { coerceToISODateString } from '../../../types/branded';
import { formatAsAmountTrimmed } from '../../../utils/formatUtils';
import {
  formatKapitaliseringsPct,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringCalculation';
import {
  buildKapitaliseringAarsydelseExpression,
  buildKapitaliseringGrundydelseExpression,
  buildKapitaliseringGrundydelseLabel,
  buildKapitaliseringOpreguleringTil2024Expression,
} from '../../../domain/erhvervsevnetab/eetKapitaliseringPresentation';
import { downloadKapitaliseringPdf } from '../../../pdf/infrastructure/pdfService';
import EetIssuesBox from './EetIssuesBox';
import HoverRow from './HoverRow';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { useEetShakeFlag } from '../../../hooks/useShakeFlag';
import { formatFaktor, formatJaNej } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import type { EetSnapshot } from '../../../domain/erhvervsevnetab/eetSnapshot';
import { formatKr } from '../../../utils/formatUtils';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  onGoToEetOplysninger: () => void;
  stamdata: StamdataValues | null;
  snapshot: EetSnapshot['kapitalisering'];
}>;


const EetKapitaliseringTab = ({ values, onGoToEetOplysninger, stamdata, snapshot }: Props) => {
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useEetShakeFlag();
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;
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
              <DocumentDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
            </Box>
          </Box>
        </ContentBox>
      )}

      {!hasBlockingErrors && afgoerelser.length === 0 && (
        <ContentBox className="content-box">
          <Typography className="section-header">Specifikation</Typography>
          <HoverRow text="Der er ingen kapitaliserede afgørelser i sagen." />
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
                <Typography className="row--text">{formatISOToDanish(coerceToISODateString(values.beregningsdato))}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatISOToDanish(afgoerelse.kapitaliseringsdato)}</Typography>
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

            {afgoerelse.grundydelse2024 !== null && afgoerelse.opreguleringTil2024PctRounded4 !== null && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">
                  {buildKapitaliseringOpreguleringTil2024Expression(
                    formatKr(afgoerelse.grundydelse, 2),
                    formatAsAmountTrimmed(1 + afgoerelse.opreguleringTil2024PctRounded4 / 100, 4),
                    `${formatAsAmountTrimmed(afgoerelse.opreguleringTil2024PctRounded4, 4)} %`
                  )}
                </Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{formatKr(afgoerelse.grundydelse2024, 2)}</Typography>
                </Box>
              </Box>
            )}

            {afgoerelse.aarsydelseReguleringsPctRounded4 !== null && (
              <Box className="row--label-right-hover">
                <Typography className="row--text">Reguleringsprocent ({formatIsoDateLong(afgoerelse.kapitaliseringsdato)})</Typography>
                <Box className="row--label-right-hover__content">
                  <Typography className="row--text">{`${formatAsAmountTrimmed(afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`}</Typography>
                </Box>
              </Box>
            )}

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {buildKapitaliseringAarsydelseExpression(
                  formatKr(afgoerelse.aarsydelseGrundlag, 2),
                  afgoerelse.aarsydelseReguleringsPctRounded4 === null
                    ? null
                    : `${formatAsAmountTrimmed(100 + afgoerelse.aarsydelseReguleringsPctRounded4, 4)} %`
                )}
              </Typography>
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
