import * as React from 'react';
import { Box } from '@mui/material';
import StandardDisplayTable from './StandardDisplayTable';
import { formatPercent } from '../../utils/formatUtils';

export type InterestRatesTableRow = Readonly<{ effectiveDate: string; ratePct: number }>;

export type InterestRatesTableProps = Readonly<{
  rows: readonly InterestRatesTableRow[];
  // Bevidst uden default: «Rentedato» er forbeholdt kravets egen rentedato (jf. renteberegning-contract
  // §2.9), så en satstabel må ikke kunne arve den overskrift ved at udelade proppen.
  dateColumnHeader: string;
}>;

/**
 * Negative referencesatser vises med luft mellem minus og tal («- 0,45 %»). Formen er et bevidst
 * visuelt valg for satstabellerne (brugerbeslutning 2026-08-25, BB-095) og må IKKE bredes til
 * `formatPercent`, som resten af programmets procentvisninger bruger. Fortegnet sættes eksplicit
 * frem for som en `replace` på det formaterede resultat, så formen ikke afhænger af, hvor i strengen
 * det første bindestreg-tegn tilfældigvis står.
 */
const formatRateWithSpacedSign = (ratePct: number): string =>
  ratePct < 0 ? `- ${formatPercent(Math.abs(ratePct))}` : formatPercent(ratePct);

const InterestRatesTable = React.memo(({ rows, dateColumnHeader }: InterestRatesTableProps) => {
  return (
    <Box sx={{ mt: 3, maxWidth: '400px' }}>
      <StandardDisplayTable
        columns={[
          { header: dateColumnHeader, align: 'center' },
          { header: 'Sats', align: 'right', headerSx: { paddingRight: '60px !important' } },
        ]}
        rows={rows.map((row, idx) => ({
          // Index-præfiks sikrer unikke keys selv hvis kilden indeholder to rækker med samme dato+sats
          // (rækkerne er en statisk, positionel visningsliste – ingen add/remove/sort).
          key: `${idx}-${row.effectiveDate}`,
          cells: [row.effectiveDate, formatRateWithSpacedSign(row.ratePct)],
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

