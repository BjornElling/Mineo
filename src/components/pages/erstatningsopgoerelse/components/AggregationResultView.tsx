import React from 'react';
import { Typography } from '@mui/material';
import { formatCurrency } from '../../../../utils/formatUtils';

interface AggregationResultViewProps {
  total: number;
}

const AggregationResultView = React.memo<AggregationResultViewProps>(({ total }) => {
  return (
    <Typography className="row--text" sx={{ fontWeight: '500 !important' }}>
      {formatCurrency(total)} kr.
    </Typography>
  );
});

AggregationResultView.displayName = 'AggregationResultView';

export default AggregationResultView;
