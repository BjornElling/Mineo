import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import { buildAldersreduktionFormelTekst } from '../../../domain/erhvervsevnetab/eetAldersreduktionFormel';
import { toKroner } from '../../../domain/money/money';
import { formatAsAmountTrimmed, formatCountWithUnit, formatKr } from '../../../utils/formatUtils';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * EAL-kravets mellemregninger: årsløn, regulering, erhvervsevnetab, minimumsniveau og aldersreduktion.
 *
 * Teksterne er BEVIDST udførlige formler: brugeren skal kunne efterprøve tallet uden at åbne dokumentet.
 * Panelet bevares, selv når ASL-siden er blokeret — panel-gates er dependency-specifikke (§1.10).
 */
const ForsoergertabEalSection = React.memo(() => {
  const { canShowEal, ealComputation, foersoergertabEalMinSatsOre, foersoergertabForhoejtetTilMin } =
    useForsoergertabVm();
  if (!canShowEal || !ealComputation) return null;

  return (
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
  );
});

ForsoergertabEalSection.displayName = 'ForsoergertabEalSection';

export default ForsoergertabEalSection;
