import React from 'react';
import { Typography } from '@mui/material';

interface CannotComputeAggregationNoticeProps {
  missingLineIds: string[];
}

const CannotComputeAggregationNotice = React.memo<CannotComputeAggregationNoticeProps>(({ missingLineIds }) => {
  return (
    <>
      <Typography className="row--text">Kan ikke beregnes endnu</Typography>
      {missingLineIds.length > 0 && (
        <Typography className="row--text" sx={{ color: 'text.secondary' }}>
          {/* NOTE: lineIds are technical identifiers; UI mapping will be added later. */}
          Mangler delberegninger: {missingLineIds.join(', ')}
        </Typography>
      )}
    </>
  );
});

CannotComputeAggregationNotice.displayName = 'CannotComputeAggregationNotice';

export default CannotComputeAggregationNotice;
