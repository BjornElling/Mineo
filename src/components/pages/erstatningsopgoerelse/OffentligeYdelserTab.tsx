import React from 'react';
import { Typography } from '@mui/material';
import OffentligeYdelserTable from '../../tables/OffentligeYdelserTable';
import ContentBox from '../../layout/ContentBox';
import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/offentligeYdelserDerived';
import { formatCurrency } from '../../../utils/formatUtils';

type Props = Readonly<{
  rows: OffentligeYdelserRow[];
  onRowsChange: (rows: OffentligeYdelserRow[]) => void;
}>;

/**
 * Offentlige ydelser-fanen - modtagne ydelser
 */
const OffentligeYdelserTab = React.memo(({ rows, onRowsChange }: Props) => {
  const formatAntalDage = React.useCallback((value: number): string => {
    return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value);
  }, []);

  const derivedByRowId = React.useMemo(() => {
    const map = new Map<string, { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string }>();
    for (const row of rows) {
      const derived = deriveOffentligeYdelserRow(row);
      map.set(row.id, {
        periodiseringLabel: derived.periodiseringLabel,
        antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
        ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatCurrency(derived.ydelsePerDag) : '',
      });
    }
    return map;
  }, [formatAntalDage, rows]);

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Offentlige ydelser</Typography>
      <Typography className="row--text" sx={{ mb: 2 }}>
        Ydelser fra offentlige myndigheder, herunder midlertidigt erhvervsevnetab.
      </Typography>

      <OffentligeYdelserTable
        tableData={rows}
        derivedByRowId={derivedByRowId}
        onTableDataChange={onRowsChange}
      />
    </ContentBox>
  );
});

OffentligeYdelserTab.displayName = 'OffentligeYdelserTab';

export default OffentligeYdelserTab;
