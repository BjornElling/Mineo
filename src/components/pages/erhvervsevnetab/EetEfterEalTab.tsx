import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../../layout/ContentBox';
import { formatIsoDateLong, formatISOToDanish } from '../../../utils/dateFormatting';
import { buildAldersreduktionEtiket } from '../../../domain/erhvervsevnetab/eetEalCalculation';
import {
  ERHVERVSEVNETAB_EAL_PCT_LABEL,
  resolveErhvervsevnetabMaksimumTekst,
} from '../../../domain/erhvervsevnetab/eetMaksimumTekst';
import { resolveStamdataDatoReference } from '../../../domain/policies/stamdataCalculations';
import EetIssuesBox from './EetIssuesBox';
import DocumentDownloadButton from '../../inputs/DocumentDownloadButton';
import DocumentOutcomeMessage from '../../inputs/DocumentOutcomeMessage';
import EetDocumentDownloadBox from './EetDocumentDownloadBox';
import { formatKr } from '../../../utils/formatUtils';
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { formatPct } from '../../../domain/erhvervsevnetab/eetFormatUtils';
import { toKroner } from '../../../domain/money/money';
import type { ErhvervsevnetabReaderProjection } from '../../../domain/erhvervsevnetab/erhvervsevnetabReaderProjection';
import { type DocumentDownloadHandle } from '../../../document/definition/react/useDocumentDownload';

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

  const aldersreduktionEtiket = computation
    ? buildAldersreduktionEtiket(computation.alderVedSkade)
    : '';

  // Ét navnevalg for hele fanen, udledt af beregningens egen skadestype (BB-121). Skadestypen bæres
  // i computation'en – ikke læst separat her – så skærmen og bilaget i differencekravet ikke kan
  // navngive den samme dato forskelligt.
  const datoReference = resolveStamdataDatoReference(computation?.skadestype);

  return (
    <Box>
      <EetIssuesBox
        issues={issues}
        onGoToEetOplysninger={onGoToEetOplysninger}
      />

      {hasBlockingErrors && <EetDocumentDownloadBox download={download} />}

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

            {/*
              Gate-blokeringer står allerede i `EetIssuesBox` ovenfor (og skjuler denne boks helt), så de
              vises ikke igen her. Tilbage er stale-afbrud og DEV-serverfejl, som ellers var lydløse.
            */}
            <DocumentOutcomeMessage message={download.errorMessage} />
          </ContentBox>

          <ContentBox className="content-box">
            <Typography className="section-header">Specifikation</Typography>

            <Typography className="row--subheading">Årsløn</Typography>

            {/*
              Sagens egen dato bærer både aldersreduktionen og opreguleringen, men fanen viste kun
              fødselsdatoen plus en færdig alder (BB-182). Uden datoen kan modparten ikke kontrollere
              «Alder på skadestidspunkt», kun indsnævre den til et år – og netop et år flytter
              aldersreduktionen et procentpoint og opreguleringen et helt reguleringsår. Rækken står i
              Specifikationen og ikke i «Beregning», så differencekravets bilag bærer den med
              (se `renderEfterEalBody`). Navnet følger skadestypen (BB-121), og formen er kort
              `dd-mm-åååå` som Fødselsdato-rækken nedenfor – de to datoer bærer tilsammen
              aldersreduktionen og skal kunne læses op mod hinanden uden at skifte format (BB-146).
            */}
            <Box className="row--label-right-hover">
              <Typography className="row--text">{datoReference.label}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatISOToDanish(computation.skadedato)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`Årsløn på ${datoReference.tidspunktBestemt}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatKr(toKroner(computation.aarsloenOre))}</Typography>
              </Box>
            </Box>

            {computation.reguleringsaar.length > 0 && (
              <>
                <Box className="row--label-right-hover">
                  <Typography className="row--text">
                    {`Regulering fra ${datoReference.aar} ${computation.skadesaar} til beregningsår ${computation.beregningsaar}`}
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
              <Typography className="row--text">{ERHVERVSEVNETAB_EAL_PCT_LABEL}</Typography>
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
                {resolveErhvervsevnetabMaksimumTekst(computation.eetReduceretTilMaks)}
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
              <Typography className="row--text">{`Alder på ${datoReference.tidspunkt}`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{`${computation.alderVedSkade} år`}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{aldersreduktionEtiket}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text">{formatPct(computation.aldersreduktionPct)}</Typography>
              </Box>
            </Box>

            <Box className="row--label-right-hover">
              <Typography className="row--text">{`${formatKr(toKroner(computation.eetAnvendtOre))} x (${formatDeductionPercent(computation.aldersreduktionPct, formatPct(computation.aldersreduktionPct))}) =`}</Typography>
              <Box className="row--label-right-hover__content">
                <Typography className="row--text text-bold">{formatDeductionKr(toKroner(computation.aldersreduktionBeloebOre))}</Typography>
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
