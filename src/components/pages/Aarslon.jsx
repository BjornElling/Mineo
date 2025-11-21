import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../common/ContentBox';
import StyledPercentField from '../inputs/StyledPercentField';
import StyledRadioButton from '../inputs/StyledRadioButton';
import AarsloenTable from '../tables/AarsloenTable';
import { usePersistedForm } from '../../hooks/usePersistedForm';

/**
 * Årsløn-side
 *
 * Beregner årsløn baseret på satser og indtægtsoplysninger
 */
const Aarslon = React.memo(() => {
  // Persisted state for satser
  const { values, setValues } = usePersistedForm('aarslon', {
    feriePct: '',
    fritvalgPct: '',
    shPct: '',
    storeBededagPct: '',
    pensionPct: '',
    loenperiode: 'maaned',
    tableData: [
      { id: 0, col0: '', col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col10: '' },
      { id: 1, col0: '', col1: '', col2: '', col3: '', col4: '', col5: '', col6: '', col10: '' },
    ],
  });

  // Destrukturér værdier for nem adgang
  const { feriePct, fritvalgPct, shPct, storeBededagPct, pensionPct, loenperiode, tableData } = values;

  // Hjælpefunktion til at opdatere enkeltfelter
  const updateField = (fieldName) => (e) => {
    setValues(prev => ({ ...prev, [fieldName]: e.target.value }));
  };

  // Funktion til at opdatere tabeldata
  const handleTableDataChange = React.useCallback((newTableData) => {
    setValues(prev => ({ ...prev, tableData: newTableData }));
  }, [setValues]);

  return (
    <Box>
      {/* Header */}
      <Typography variant="h4" sx={{ marginBottom: 3 }}>
        Årslønsberegning
      </Typography>

      {/* Container 1: Satser */}
      <ContentBox>
        <Typography variant="h6" sx={{ marginBottom: 2 }}>
          Satser
        </Typography>

        {/* Satser-felter */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>

          {/* Feriegodtgørelse/-tillæg */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ minWidth: '200px' }}>
              Feriegodtgørelse/-tillæg:
            </Typography>
            <StyledPercentField
              value={feriePct}
              onChange={updateField('feriePct')}
              placeholder="0 %"
              sx={{ width: '100px' }}
            />
          </Box>

          {/* Fritvalg */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ minWidth: '200px' }}>
              Fritvalg:
            </Typography>
            <StyledPercentField
              value={fritvalgPct}
              onChange={updateField('fritvalgPct')}
              placeholder="0 %"
              sx={{ width: '100px' }}
            />
          </Box>

          {/* SH-/Særlig Opsparing */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ minWidth: '200px' }}>
              SH-/Særlig Opsparing:
            </Typography>
            <StyledPercentField
              value={shPct}
              onChange={updateField('shPct')}
              placeholder="0 %"
              sx={{ width: '100px' }}
            />
          </Box>

          {/* Store Bededagstillæg */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ minWidth: '200px' }}>
              Store Bededagstillæg:
            </Typography>
            <StyledPercentField
              value={storeBededagPct}
              onChange={updateField('storeBededagPct')}
              placeholder="0 %"
              sx={{ width: '100px' }}
            />
          </Box>

          {/* Arbejdsgivers pensionsbidrag */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ minWidth: '200px' }}>
              Arbejdsgivers pensionsbidrag:
            </Typography>
            <StyledPercentField
              value={pensionPct}
              onChange={updateField('pensionPct')}
              placeholder="0 %"
              sx={{ width: '100px' }}
            />
          </Box>

        </Box>

        {/* Lønperiode med radioknapper */}
        <Box sx={{ marginTop: 3 }}>
          <StyledRadioButton
            label="Lønperiode:"
            value={loenperiode}
            onChange={updateField('loenperiode')}
            row={true}
            options={[
              { value: 'maaned', label: 'Månedsløn' },
              { value: 'uge', label: 'Ugeløn' },
              { value: 'dag', label: 'Dagsløn' },
            ]}
          />
        </Box>

      </ContentBox>

      {/* Container 2: Indtægtsoplysninger */}
      <ContentBox sx={{ marginTop: 3 }}>
        <Typography variant="h6" sx={{ marginBottom: 2 }}>
          Indtægtsoplysninger
        </Typography>

        <AarsloenTable
          loenperiode={loenperiode}
          satser={{
            ferie: feriePct,
            fritvalg: fritvalgPct,
            sh: shPct,
            bededag: storeBededagPct,
            pension: pensionPct
          }}
          tableData={tableData}
          onTableDataChange={handleTableDataChange}
        />
      </ContentBox>
    </Box>
  );
});

Aarslon.displayName = 'Aarslon';

export default Aarslon;
