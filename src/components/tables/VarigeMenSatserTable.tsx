import * as React from 'react';
import { Box } from '@mui/material';
import StandardDisplayTable from './StandardDisplayTable';
import { varigeMenPrGrad } from '../../data/regulationRates';
import { formatAsAmountTrimmed } from '../../utils/formatUtils';

const formatKronerPerMengrad = (value: number): string =>
  `${formatAsAmountTrimmed(value, 2)} kr.`;

const VarigeMenSatserTable = React.memo(() => {
  const years = Object.keys(varigeMenPrGrad)
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);

  return (
    <Box sx={{ mt: 3, maxWidth: '500px' }}>
      <StandardDisplayTable
        columns={[
          { header: 'Opgørelsesår', align: 'center' },
          { header: 'Sats pr. méngrad', align: 'center' },
        ]}
        rows={years.map((year) => ({
          key: String(year),
          cells: [String(year), formatKronerPerMengrad(varigeMenPrGrad[year])],
        }))}
        tableSx={{
          '& .MuiTableCell-root': {
            paddingLeft: '50px',
            paddingRight: '50px',
          },
          '& tbody td:nth-of-type(2)': {
            textAlign: 'right',
            paddingRight: '80px !important',
          },
        }}
      />
    </Box>
  );
});

VarigeMenSatserTable.displayName = 'VarigeMenSatserTable';

export default VarigeMenSatserTable;
