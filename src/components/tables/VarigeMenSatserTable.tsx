import * as React from 'react';
import { Box } from '@mui/material';
import StandardDisplayTable from './StandardDisplayTable';
import { varigeMenPrGrad } from '../../data/lovbestemteRates';
import { formatKr } from '../../utils/formatUtils';

// Varige mén vises konsekvent i hele kroner uden decimaler (`varigemen-contract.md` §2.9), og
// enheden kommer fra den kanoniske `formatKr` frem for en inline " kr."-streng (BB-078).
const formatKronerPerMengrad = (value: number): string => formatKr(value);

const VarigeMenSatserTable = React.memo(() => {
  const years = Object.keys(varigeMenPrGrad)
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);

  return (
    <Box sx={{ mt: 3, maxWidth: '500px' }}>
      <StandardDisplayTable
        columns={[
          { header: 'Beregningsår', align: 'center' },
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
