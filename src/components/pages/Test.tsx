import React from 'react';
import { Box, Button, MenuItem, Typography } from '@mui/material';

import type { ISODateString } from '../../types/branded';
import StyledAmountField from '../inputs/StyledAmountField';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import StyledDateField from '../inputs/StyledDateField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledFractionField from '../inputs/StyledFractionField';
import StyledIntegerField from '../inputs/StyledIntegerField';
import StyledPercentField from '../inputs/StyledPercentField';
import StyledTextField from '../inputs/StyledTextField';
import StyledToggleSwitch from '../inputs/StyledToggleSwitch';
import type { CommitEvent } from '../inputs/fieldEvents';
import StyledWeekField from '../inputs/StyledWeekField';
import StyledYearField from '../inputs/StyledYearField';
import ContentBox from '../layout/ContentBox';
import { markDevtoolsTestScenario } from '../../utils/devtoolsMonitor';

/**
 * Test-side til afprøvning af styled-komponenter
 */
const Test = React.memo(() => {
  // Lokale state-værdier til test af komponenterne
  const [textValue, setTextValue] = React.useState('');
  const [dateValue, setDateValue] = React.useState<ISODateString | undefined>(undefined);
  const [dropdownValue, setDropdownValue] = React.useState('');
  const [integerValue, setIntegerValue] = React.useState<number | undefined>(undefined);
  const [amountValue, setAmountValue] = React.useState<AmountValue | undefined>(undefined);
  const [percentValue, setPercentValue] = React.useState<number | undefined>(undefined);
  const [fractionValue, setFractionValue] = React.useState<string | undefined>(undefined);
  const [weekValue, setWeekValue] = React.useState<string | undefined>(undefined);
  const [yearValue, setYearValue] = React.useState<number | undefined>(undefined);
  const [toggleValue, setToggleValue] = React.useState(false);

  return (
    <Box>

      <ContentBox className="content-box">
        <Typography className="section-header">Styled-komponenter</Typography>

        {/* StyledTextField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledTextField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledTextField
              value={textValue}
              onCommit={(e) => setTextValue(String(e.target.value || ''))}
              placeholder="Indtast tekst"
              width={220}
            />
          </Box>
        </Box>

        {/* StyledDateField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledDateField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledDateField
              value={dateValue}
              onCommit={(e) => setDateValue(e.target.value)}
            />
          </Box>
        </Box>

        {/* StyledDropdown */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledDropdown
          </Typography>
          <Box className="row--label-offset__content">
            <StyledDropdown
              value={dropdownValue || undefined}
              onChange={(e) => setDropdownValue(String(e.target.value || ''))}
              placeholder="Vælg en mulighed"
              width={220}
            >
              <MenuItem value="option1">Mulighed 1</MenuItem>
              <MenuItem value="option2">Mulighed 2</MenuItem>
              <MenuItem value="option3">Mulighed 3</MenuItem>
            </StyledDropdown>
          </Box>
        </Box>

        {/* StyledIntegerField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledIntegerField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledIntegerField
              value={integerValue}
              onCommit={(e) => setIntegerValue(e.target.value)}
              placeholder="Heltal"
              width={140}
            />
          </Box>
        </Box>

        {/* StyledAmountField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledAmountField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledAmountField
              value={amountValue}
              onCommit={(e) => setAmountValue(e.target.value)}
              placeholder="Beløb"
              width={160}
            />
          </Box>
        </Box>

        {/* StyledPercentField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledPercentField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledPercentField
              value={percentValue}
              onCommit={(e) => setPercentValue(e.target.value)}
              placeholder="Procent"
              width={120}
              useDefaultPercentRange
            />
          </Box>
        </Box>

        {/* StyledFractionField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledFractionField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledFractionField
              value={fractionValue}
              onCommit={(e) => setFractionValue(e.target.value)}
              placeholder="Brøk"
              width={120}
            />
          </Box>
        </Box>

        {/* StyledWeekField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledWeekField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledWeekField
              value={weekValue}
              onCommit={(e) => setWeekValue(e.target.value)}
            />
          </Box>
        </Box>

        {/* StyledYearField */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledYearField
          </Typography>
          <Box className="row--label-offset__content">
            <StyledYearField
              value={yearValue}
              onCommit={(e) => setYearValue(e.target.value)}
            />
          </Box>
        </Box>

        {/* StyledToggleSwitch */}
        <Box className="row--label-offset">
          <Typography className="row--text" minWidth="250px">
            StyledToggleSwitch
          </Typography>
          <Box className="row--label-offset__content">
            <StyledToggleSwitch
              checked={toggleValue}
              onCommit={(e: CommitEvent<boolean>) => setToggleValue(e.target.value)}
            />
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Devtools test</Typography>

        <Box sx={{ display: 'flex', gap: 2, marginTop: 1 }}>
          <Button
            variant="outlined"
            onClick={() => {
              markDevtoolsTestScenario('Devtools test warning (intentional)', { source: 'Test page' });
              console.warn('Devtools test warning (intentional)');
            }}
          >
            Udløs advarsel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              markDevtoolsTestScenario('Devtools test error (intentional)', { source: 'Test page' });
              console.error('Devtools test error (intentional)');
            }}
          >
            Udløs fejl
          </Button>
        </Box>
      </ContentBox>
    </Box>
  );
});

Test.displayName = 'Test';

export default Test;
