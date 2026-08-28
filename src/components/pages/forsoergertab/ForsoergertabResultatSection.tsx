import React from 'react';
import { Box, Typography } from '@mui/material';

import ContentBox from '../../layout/ContentBox';
import { formatKr } from '../../../utils/formatUtils';
import { formatDeductionKr } from '../../../utils/deductionFormatting';
import { useForsoergertabVm } from './forsoergertabContext';

/**
 * Beregnet forsørgertab: nettokravet og de tre led, det er sammensat af.
 *
 * Vises kun når snapshottet har et resultat (`canShowResult`) – der findes ingen visningsvej, der kunne vise et
 * delresultat fra en blokeret beregning (§1.10).
 */
const ForsoergertabResultatSection = React.memo(() => {
  const { canShowResult, result } = useForsoergertabVm();
  if (!canShowResult || !result) return null;

  return (
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
          <Typography className="row--text">{formatDeductionKr(result.aslLobendeYdelserTotal)}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Kapitalbeløb (efter ASL)</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text">{formatDeductionKr(result.aslKapitalbelob)}</Typography>
        </Box>
      </Box>

      <Box className="row--label-right-hover">
        <Typography className="row--text">Forsørgertabserstatning</Typography>
        <Box className="row--label-right-hover__content">
          <Typography className="row--text text-bold">{formatKr(result.nettokrav)}</Typography>
        </Box>
      </Box>
    </ContentBox>
  );
});

ForsoergertabResultatSection.displayName = 'ForsoergertabResultatSection';

export default ForsoergertabResultatSection;
