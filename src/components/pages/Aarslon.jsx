import React from 'react';
import { Box, Typography, Button } from '@mui/material';
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

  // Ref til AarsloenTable for at kalde sortTable
  const tableRef = React.useRef(null);

  return (
    <Box>
      {/* Header */}
      <Typography
        variant="h4"
        sx={{
          fontFamily: 'Ubuntu',
          fontWeight: 700,
          marginBottom: 3,
          color: 'rgba(0, 0, 0, 0.87)'
        }}
      >
        Årslønsberegning
      </Typography>

      {/* Container 1: Satser */}
      <ContentBox>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'Ubuntu',
            fontWeight: 500,
            marginBottom: 2
          }}
        >
          Satser
        </Typography>

        {/* Satser-felter */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>

          {/* Feriegodtgørelse/-tillæg */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '14px',
                minWidth: '200px',
                color: 'rgba(0, 0, 0, 0.87)'
              }}
            >
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
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '14px',
                minWidth: '200px',
                color: 'rgba(0, 0, 0, 0.87)'
              }}
            >
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
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '14px',
                minWidth: '200px',
                color: 'rgba(0, 0, 0, 0.87)'
              }}
            >
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
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '14px',
                minWidth: '200px',
                color: 'rgba(0, 0, 0, 0.87)'
              }}
            >
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
            <Typography
              sx={{
                fontFamily: 'Ubuntu',
                fontSize: '14px',
                minWidth: '200px',
                color: 'rgba(0, 0, 0, 0.87)'
              }}
            >
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontFamily: 'Ubuntu',
              fontWeight: 500
            }}
          >
            Indtægtsoplysninger
          </Typography>

          <Button
            variant="contained"
            onClick={() => tableRef.current?.sortTable()}
            sx={{
              fontFamily: 'Ubuntu',
              fontSize: '14px',
              textTransform: 'none',
              backgroundColor: '#1976d2',
              '&:hover': {
                backgroundColor: '#1565c0'
              }
            }}
          >
            Sorter tabel
          </Button>
        </Box>

        <AarsloenTable
          ref={tableRef}
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
