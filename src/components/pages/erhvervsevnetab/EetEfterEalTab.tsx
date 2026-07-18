import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import { downloadEfterEalDokument } from '../../../document/service/documentService';
import EetIssuesBox from './EetIssuesBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { formatKr } from '../../../utils/formatUtils';
import { formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { buildErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { evaluateEetFaneDownloadGate } from '../../../domain/erhvervsevnetab/erhvervsevnetabDownloadGate';
import type { DocumentDownloadGateResult } from '../../../document/layout/documentGateTypes';
import { useCriticalInputActions } from '../../../inputCore/react/useInputEvaluation';
import { captureProductionEvaluationSource } from '../../../inputCore/react/productionInputRuntime';
import { sourceTokensEqual } from '../../../inputCore/evaluationSource';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  downloadGate: DocumentDownloadGateResult;
}>;



const EetEfterEalTab = ({ onGoToEetOplysninger, projection, downloadGate }: Props) => {
  const criticalActions = useCriticalInputActions();
  const snapshot = projection.snapshot.efterEal;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;

  const handlePdfDownload = React.useCallback(async () => {
    const preparation = await criticalActions.prepare('download');
    if (preparation.status !== 'committed') {
      if (preparation.status === 'blocked') preparation.target?.focus();
      return;
    }
    const source = captureProductionEvaluationSource();
    if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) return;
    const freshProjection = buildErhvervsevnetabReaderProjection(source.evaluation.reader);
    const freshSnapshot = freshProjection.snapshot.efterEal;
    const freshGate = evaluateEetFaneDownloadGate('efterEal', freshSnapshot);
    const freshStamdata = freshProjection.documentStamdata;
    if (!freshGate.canDownload || freshSnapshot.computation === null || freshStamdata.status !== 'ready') return;
    await downloadEfterEalDokument({
      computation: freshSnapshot.computation,
      settings: source.settings,
      persistedStamdata: freshStamdata.value,
      isSourceCurrent: source.isSourceCurrent,
    });
  }, [criticalActions]);

  const aldersreduktionFormula = computation
    ? buildAldersreduktionFormelTekst(computation.alderVedSkade)
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
                <DocumentDownloadButton
                  onClick={handlePdfDownload}
                  disabled={!downloadGate.canDownload}
                  disabledReason={downloadGate.reasons[0]?.message}
                />
              </Box>
            </Box>
          </ContentBox>

          <ContentBox className="content-box">
            <Typography className="section-header">Specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Årsløn på skadestidspunktet</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(computation.aarsloenOre))}</Typography>
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
                    {`${formatKr(toKroner(computation.aarsloenOre))} x (100 % + ${formatPct(computation.reguleringsPctRounded4)}) (afrundet) =`}
                  </Typography>
                  <Box className="row--label-right-hover__content">
                    <Typography className="row--text">{formatKr(toKroner(computation.reguleretAarsloenOre))}</Typography>
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
                {`Erhvervsevnetab (${formatKr(toKroner(computation.reguleretAarsloenOre))} x 10 x ${formatPct(computation.eetPct)}) =`}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(computation.eetBeregnetOre))}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Maksimalt erhvervsevnetab i beregningsåret {computation.beregningsaar}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(computation.eetMaksOre))}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">
                {computation.eetReduceretTilMaks
                  ? 'Skadelidtes erhvervsevnetab reduceres til det lovbestemte maksimum'
                  : 'Skadelidtes erhvervsevnetab skal ikke reduceres, dvs. udgør'}
              </Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatKr(toKroner(computation.eetAnvendtOre))}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Aldersreduktion</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">Fødselsdato</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatISOToDanish(computation.fodselsdato)}</Typography>
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
              <Typography className="row--text">{`${formatKr(toKroner(computation.eetAnvendtOre))} x (- ${formatPct(computation.aldersreduktionPct)}) =`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{`- ${formatKr(toKroner(computation.aldersreduktionBeloebOre))}`}</Typography>
              </Box>
            </Box>

            <Typography className="row--subheading">Beregnet EAL-krav</Typography>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`${formatKr(toKroner(computation.eetAnvendtOre))} - ${formatKr(toKroner(computation.aldersreduktionBeloebOre))} =`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatKr(toKroner(computation.ealKravOre))}</Typography>
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
