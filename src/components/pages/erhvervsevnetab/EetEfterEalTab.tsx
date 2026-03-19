import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { usePersistedSection } from '../../../hooks/usePersistedSection';
import { useFormFieldErrors } from '../../../hooks/useFormFieldErrors';
import { useAppSettings } from '../../../contexts/useAppSettings';
import { formatIsoDateLong, formatIsoDateShort } from '../../../utils/dateFormatting';
import { dedupeIssuesBySeverityAndMessage } from '../../../utils/issueUtils';
import { aarsloenMax, erhvervsevnetabMax, reguleringssats } from '../../../data/regulationRates';
import {
  buildAldersreduktionFormelTekst,
  computeEetEalCalculation,
  formatPercentTrimmedFromRounded4,
} from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { downloadEfterEalPdf } from '../../../utils/pdf/pdfService';
import EetIssuesBox from './EetIssuesBox';
import PdfDownloadButton from '../../inputs/PdfDownloadButton';
import { useEetShakeFlag } from './useEetShakeFlag';
import { formatKr, navigationSortKey, toFieldIssue } from './eetTabSharedUtils';

type Props = Readonly<{
  values: ErhvervsevnetabComposedValues;
  onGoToEetOplysninger: () => void;
}>;

const formatPct = (value: number): string => `${formatPercentTrimmedFromRounded4(value)} %`;


const EetEfterEalTab: React.FC<Props> = ({ values, onGoToEetOplysninger }) => {
  const stamdata = usePersistedSection('stamdata');
  const stamdataFieldErrors = useFormFieldErrors('stamdata');
  const eetFieldErrors = useFormFieldErrors('erhvervsevnetab');
  const faellesAarsloenFieldErrors = useFormFieldErrors('faellesAarsloen');
  const faellesPersondataFieldErrors = useFormFieldErrors('faellesPersondata');
  const { settings } = useAppSettings();
  const { shake: downloadShake, triggerShake: triggerDownloadShake } = useEetShakeFlag();

  const calculationResult = React.useMemo(
    () =>
      computeEetEalCalculation({
        erhvervsevnetab: values,
        skadesdato: stamdata?.skadesdato,
        skadelidteFodselsdato: values.skadelidteFodselsdato,
        reguleringssats,
        erhvervsevnetabMax,
        aarsloenMax,
      }),
    [stamdata?.skadesdato, values]
  );

  const fieldIssues = React.useMemo(() => {
    return [
      toFieldIssue('field-beregningsdato', eetFieldErrors.beregningsdato?.message),
      toFieldIssue('field-eal-eet-pct', eetFieldErrors.ealEetPct?.message),
      toFieldIssue('field-aarsloen-eal', faellesAarsloenFieldErrors.ealAarsloen?.message),
      toFieldIssue('field-skadelidte-fodselsdato', faellesPersondataFieldErrors.skadelidteFodselsdato?.message),
      toFieldIssue('field-skadesdato', stamdataFieldErrors.skadesdato?.message),
    ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
  }, [
    eetFieldErrors.beregningsdato?.message,
    eetFieldErrors.ealEetPct?.message,
    faellesPersondataFieldErrors.skadelidteFodselsdato?.message,
    faellesAarsloenFieldErrors.ealAarsloen?.message,
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

  const handlePdfDownload = React.useCallback(async () => {
    if (!computation) {
      triggerDownloadShake();
      return;
    }
    await downloadEfterEalPdf({
      computation,
      settings,
      persistedStamdata: stamdata,
    });
  }, [computation, settings, stamdata, triggerDownloadShake]);

  const aldersreduktionFormula = computation
    ? buildAldersreduktionFormelTekst(computation.alderVedSkade, computation.alderVedSkadeCapped)
    : '';

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {!hasBlockingErrors && computation && (
        <>
          <ContentBox className="content-box">
            <Typography className="section-header">Beregning</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Beregningsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatIsoDateLong(computation.beregningsdato)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Download specifikation</Typography>
              <Box className="row--label-right-hover__content">
                <PdfDownloadButton onClick={handlePdfDownload} shake={downloadShake} />
              </Box>
            </Box>
          </ContentBox>

          <ContentBox className="content-box">
            <Typography className="section-header">Specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Årsløn på skadestidspunktet</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.aarsloen)}</Typography>
              </Box>
            </Box>

            {computation.reguleringsaar.length > 0 && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    Regulering fra skadesår {computation.skadesaar} til beregningsår {computation.beregningsaar}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">+ {formatPct(computation.reguleringsPctRounded4)}</Typography>
                  </Box>
                </Box>

                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`${formatKr(computation.aarsloen)} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(computation.reguleretAarsloen)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            <Typography className="row--subheading">Erhvervsevnetab</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Endeligt erhvervsevnetab</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatPct(computation.eetPct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Kapitaliseringsfaktor</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{computation.kapitaliseringsfaktor}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {`${formatKr(computation.reguleretAarsloen)} x 10 x ${formatPct(computation.eetPct)} =`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.eetBeregnet)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Maksimalt erhvervsevnetab i beregningsåret {computation.beregningsaar}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(computation.eetMaks)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {computation.eetReduceretTilMaks
                  ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
                  : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør'}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatKr(computation.eetAnvendt)}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Aldersreduktion</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Fødselsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatIsoDateShort(computation.fodselsdato)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Alder på skadestidspunkt</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${computation.alderVedSkade} år`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Aldersreduktion ${aldersreduktionFormula}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatPct(computation.aldersreduktionPct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`${formatKr(computation.eetAnvendt)} x (- ${formatPct(computation.aldersreduktionPct)}) =`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{`- ${formatKr(computation.aldersreduktionBeloeb)}`}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Beregnet EAL-krav</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`${formatKr(computation.eetAnvendt)} - ${formatKr(computation.aldersreduktionBeloeb)} =`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatKr(computation.ealKrav)}</Typography>
              </Box>
            </Box>
          </ContentBox>
        </>
      )}

    </Box>
  );
};

EetEfterEalTab.displayName = 'EetEfterEalTab';

export default EetEfterEalTab;
