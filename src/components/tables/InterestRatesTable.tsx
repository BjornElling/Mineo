import * as React from 'react';
import { Box } from '@mui/material';
import StandardDisplayTable from './StandardDisplayTable';
import { formatPercent } from '../../utils/formatUtils';

export type InterestRatesTableRow = Readonly<{ effectiveDate: string; ratePct: number }>;

export type InterestRatesTableProps = Readonly<{
  rows: readonly InterestRatesTableRow[];
  dateColumnHeader?: string;
  rateColumnHeader?: string;
}>;

const InterestRatesTable = React.memo(({ rows, dateColumnHeader = 'Rentedato', rateColumnHeader = 'Sats' }: InterestRatesTableProps) => {
  return (
    <Box sx={{ mt: 3, maxWidth: '400px' }}>
      <StandardDisplayTable
        columns={[
          { header: dateColumnHeader, align: 'center' },
          { header: rateColumnHeader, align: 'right', headerSx: { paddingRight: '60px !important' } },
        ]}
        rows={rows.map((row, idx) => ({
          // Index-præfiks sikrer unikke keys selv hvis kilden indeholder to rækker med samme dato+sats
          // (rækkerne er en statisk, positionel visningsliste – ingen add/remove/sort).
          key: `${idx}-${row.effectiveDate}`,
          cells: [row.effectiveDate, formatPercent(row.ratePct).replace('-', '- ')],
        }))}
        tableSx={{
          '& .MuiTableCell-root': {
            paddingLeft: '50px',
            paddingRight: '50px',
          },
        }}
      />
    </Box>
  );
});

InterestRatesTable.displayName = 'InterestRatesTable';

export default InterestRatesTable;

