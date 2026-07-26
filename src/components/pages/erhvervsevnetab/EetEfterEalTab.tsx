import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import EetIssuesBox from './EetIssuesBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import { formatKr } from '../../../utils/formatUtils';
import { formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import type { DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';

type Props = Readonly<{
  onGoToEetOplysninger: () => void;
  projection: ErhvervsevnetabReaderProjection;
  /** Dokumentoutputtet, komponeret af siden. Fanen aktiverer det; den konfigurerer det ikke. */
  download: DocumentDownloadHandle<void>;
}>;



const EetEfterEalTab = ({ onGoToEetOplysninger, projection, download }: Props) => {
  const snapshot = projection.snapshot.efterEal;
  const issues = snapshot.issues;
  const hasBlockingErrors = snapshot.hasBlockingErrors;
  const computation = snapshot.computation;

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
                  onClick={() => void download.download(undefined)}
                  disabled={!download.canDownload}
                  disabledReason={download.disabledReason}
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
