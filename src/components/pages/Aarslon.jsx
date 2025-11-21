import React from 'react';
import { Box, Typography } from '@mui/material';
import ContentBox from '../common/ContentBox';
import StyledPercentField from '../inputs/StyledPercentField';
import StyledRadioButton from '../inputs/StyledRadioButton';
import AarsloenTable from '../tables/AarsloenTable';

/**
 * Årsløn-side
 *
 * Beregner årsløn baseret på satser og indtægtsoplysninger
 */
const Aarslon = React.memo(() => {
  // State for satser
  const [feriePct, setFeriePct] = React.useState('');
  const [fritvalgPct, setFritvalgPct] = React.useState('');
  const [shPct, setShPct] = React.useState('');
  const [storeBededagPct, setStoreBededagPct] = React.useState('');
  const [pensionPct, setPensionPct] = React.useState('');
  const [loenperiode, setLoenperiode] = React.useState('maaned');

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
              onChange={(e) => setFeriePct(e.target.value)}
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
              onChange={(e) => setFritvalgPct(e.target.value)}
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
              onChange={(e) => setShPct(e.target.value)}
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
              onChange={(e) => setStoreBededagPct(e.target.value)}
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
              onChange={(e) => setPensionPct(e.target.value)}
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
            onChange={(e) => setLoenperiode(e.target.value)}
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
        />
      </ContentBox>
    </Box>
  );
});

Aarslon.displayName = 'Aarslon';

export default Aarslon;
