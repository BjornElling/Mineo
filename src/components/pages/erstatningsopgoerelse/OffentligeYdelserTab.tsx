import React from 'react';
import { Box, Typography } from '@mui/material';
import OffentligeYdelserTable from '../../tables/OffentligeYdelserTable';
import ContentBox from '../../layout/ContentBox';
import type { UsePersistedFormReturn } from '../../../hooks/usePersistedForm';
import type { ErstatningsopgoerelseValues, OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { deriveOffentligeYdelserRow } from '../../../domain/erstatningsopgoerelse/offentligeYdelserDerived';
import { formatCurrency } from '../../../utils/formatUtils';

type ErstatningsopgoerelseFormApi = Pick<UsePersistedFormReturn<ErstatningsopgoerelseValues>, 'values' | 'setValues'>;

/**
 * Offentlige ydelser-fanen - modtagne ydelser
 */
const OffentligeYdelserTab = React.memo(({ form }: { form: ErstatningsopgoerelseFormApi }) => {
  const { values, setValues } = form;

  const formatAntalDage = React.useCallback((value: number): string => {
    return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value);
  }, []);

  const handleTableDataChange = React.useCallback(
    (newData: OffentligeYdelserRow[]) => {
      setValues((prev) => ({
        ...prev,
        offentligeYdelserRows: newData,
      }));
    },
    [setValues]
  );

  const derivedByRowId = React.useMemo(() => {
    const map = new Map<string, { periodiseringLabel: string; antalDageDisplay: string; ydelsePerDagDisplay: string }>();
    for (const row of values.offentligeYdelserRows ?? []) {
      const derived = deriveOffentligeYdelserRow(row);
      map.set(row.id, {
        periodiseringLabel: derived.periodiseringLabel,
        antalDageDisplay: derived.antalDage !== null ? formatAntalDage(derived.antalDage) : '',
        ydelsePerDagDisplay: derived.ydelsePerDag !== null ? formatCurrency(derived.ydelsePerDag) : '',
      });
    }
    return map;
  }, [formatAntalDage, values.offentligeYdelserRows]);

  return (
    <ContentBox className="content-box">
      <Typography className="section-header">Offentlige ydelser</Typography>
      <Typography className="row--text" sx={{ mb: 2 }}>
        Ydelser fra offentlige myndigheder, herunder midlertidigt erhvervsevnetab.
      </Typography>

      <OffentligeYdelserTable
        tableData={values.offentligeYdelserRows || []}
        derivedByRowId={derivedByRowId}
        onTableDataChange={handleTableDataChange}
      />
    </ContentBox>
  );
});

OffentligeYdelserTab.displayName = 'OffentligeYdelserTab';

export default OffentligeYdelserTab;
