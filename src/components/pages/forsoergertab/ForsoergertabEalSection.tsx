import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import { buildAldersreduktionEtiket } from '../../../domain/erhvervsevnetab/eetAldersreduktionFormel';
import { resolveErhvervsevnetabMaksimumTekst } from '../../../domain/erhvervsevnetab/eetMaksimumTekst';
import {
  FORSOERGERTAB_EAL_GRUNDPRINCIP,
  resolveForsoergertabMinimumTekst,
} from '../../../domain/forsoergertab/forsoergertabEalTekster';
import { toKroner } from '../../../domain/money/money';
import { formatAsAmountTrimmed, formatCountWithUnit, formatKr, formatPercentRounded4 } from '../../../utils/formatUtils';
import { formatDeductionKr, formatDeductionPercent } from '../../../utils/deductionFormatting';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * EAL-kravets mellemregninger: årsløn, regulering, det fulde erhvervsevnetab, forsørgertabets andel af
 * det og aldersreduktionen.
 *
 * Teksterne er BEVIDST udførlige formler: brugeren skal kunne efterprøve tallet uden at åbne dokumentet.
 * Panelet bevares, selv når ASL-siden er blokeret – panel-gates er dependency-specifikke (§1.10).
 */
const ForsoergertabEalSection = React.memo(() => {
  const {
    canShowEal,
    ealComputation,
    foersoergertabEalMinSatsOre,
    foersoergertabForhoejtetTilMin,
    datoReference,
  } = useForsoergertabVm();
  if (!canShowEal || !ealComputation) return null;

  return (
    <ContentBox className="content-box" data-section-id="forsoergertab-eal">
      <Typography className="section-header">EAL-krav</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{FORSOERGERTAB_EAL_GRUNDPRINCIP}</Typography>
        <Box className="row--label-right-hover__content" />
      </Box>

      <Typography className="row--subheading">Årsløn</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Skadelidtes årsløn</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.aarsloenOre))}</Typography>
        </Box>
      </Box>

      {ealComputation.reguleringsaar.length > 0 && (
        <>
          <Box className="row--label-right-hover">
            <Typography className="row--text">
              {`Regulering fra ${datoReference.aar} ${ealComputation.skadesaar} til beregningsår ${ealComputation.beregningsaar}`}
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

      <Typography className="row--subheading">Fuldt erhvervsevnetab</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Erhvervsevnetab</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatPercentRounded4(ealComputation.eetPct)}</Typography>
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
          {`Erhvervsevnetab (${formatKr(toKroner(ealComputation.reguleretAarsloenOre))} x ${ealComputation.kapitaliseringsfaktor} x ${formatPercentRounded4(ealComputation.eetPct)}) =`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.eetBeregnetOre))}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Maksimalt erhvervsevnetab i beregningsåret ${ealComputation.beregningsaar}`}</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.eetMaksOre))}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {resolveErhvervsevnetabMaksimumTekst(ealComputation.eetReduceretTilMaks)}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.eetAnvendtOre))}</Typography>
        </Box>
      </Box>

      <Typography className="row--subheading">Forsørgertab</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Erstatningsprocent</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatPercentRounded4(ealComputation.forsoergertabPct)}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {`Beregnet forsørgertab (${formatKr(toKroner(ealComputation.eetAnvendtOre))} x ${formatPercentRounded4(ealComputation.forsoergertabPct)}) =`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.forsoergertabBeregnetOre))}</Typography>
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
          {resolveForsoergertabMinimumTekst(foersoergertabForhoejtetTilMin)}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatKr(toKroner(ealComputation.forsoergertabAnvendtOre))}</Typography>
        </Box>
      </Box>

      <Typography className="row--subheading">Aldersreduktion</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">{`Skadelidtes alder på ${datoReference.tidspunkt}`}</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatCountWithUnit(ealComputation.alderVedSkade, 'år', 'år')}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {buildAldersreduktionEtiket(ealComputation.alderVedSkade)}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{`${ealComputation.aldersreduktionPct} %`}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {`${formatKr(toKroner(ealComputation.forsoergertabAnvendtOre))} x (${formatDeductionPercent(ealComputation.aldersreduktionPct, `${ealComputation.aldersreduktionPct} %`)}) =`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatDeductionKr(toKroner(ealComputation.aldersreduktionBeloebOre))}</Typography>
        </Box>
      </Box>

      <Typography className="row--subheading">Beregnet EAL-krav</Typography>

      <Box className="row--label-right-hover">
        <Typography className="row--text">
          {`${formatKr(toKroner(ealComputation.forsoergertabAnvendtOre))} - ${formatKr(toKroner(ealComputation.aldersreduktionBeloebOre))} =`}
        </Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text text-bold">{formatKr(toKroner(ealComputation.ealKravOre))}</Typography>
        </Box>
      </Box>
    </ContentBox>
  );
});

ForsoergertabEalSection.displayName = 'ForsoergertabEalSection';

export default ForsoergertabEalSection;
