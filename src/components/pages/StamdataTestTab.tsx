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
import type { CommitEvent } from '../../types/fieldEvents';
import StyledWeekField from '../inputs/StyledWeekField';
import StyledYearField from '../inputs/StyledYearField';
import ContentBox from '../layout/ContentBox';
import { markDevtoolsTestScenario } from '../../utils/devtoolsMonitor';
import { reportSystemIssue } from '../../utils/systemIssueReporter';

/**
 * Test-tab til afprøvning af styled-komponenter og devtools.
 *
 * Synlighed kræver både udviklingsmiljø (import.meta.env.DEV) og at indstillingen
 * "Vis test-fane på Stamdata-tab" er slået til. Indstillingen kan kun ændres i
 * udviklingsmiljøet, og Stamdata-siden gater visningen på import.meta.env.DEV, så
 * en localStorage-værdi gemt under en dev-session aldrig viser fanen i en
 * produktions-build.
 */
const StamdataTestTab = React.memo(() => {
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

  const triggerDevtoolsWarning = React.useCallback(() => {
    markDevtoolsTestScenario('Devtools test warning (intentional)', { source: 'Test page' });
    console.warn('Devtools test warning (intentional)');
  }, []);

  const triggerDevtoolsError = React.useCallback(() => {
    markDevtoolsTestScenario('Devtools test error (intentional)', { source: 'Test page' });
    reportSystemIssue({
      code: 'devtools:test_error',
      area: 'devtools',
      context: 'TestPage',
      userMessage: 'Devtools test error (intentional)',
      revision: 'test-trigger',
    });
  }, []);

  const triggerTafPerYearAfrundingError = React.useCallback(() => {
    markDevtoolsTestScenario('EO TAF fordelt på år: afstemningsfejl over 1 kr. (intentional)', {
      source: 'Test page',
      page: 'Erstatningsopgørelse',
      tab: 'Beregning',
      invariantId: 'taf_per_year:afrunding_over_100',
    });
    reportSystemIssue({
      code: 'taf_per_year:afrunding_over_100',
      area: 'eo',
      context: 'EOberegningTab',
      userMessage: 'TAF fordelt på år kan ikke afstemmes inden for 1 kr.',
      revision: 'test-trigger',
      evidence: ['Afrunding: 123', 'Årssum: 100000', 'Samlet TAF-krav: 99877'],
      diagnostics: {
        invariantId: 'taf_per_year:afrunding_over_100',
      },
    });
  }, []);

  const triggerControlMismatchError = React.useCallback(() => {
    markDevtoolsTestScenario('EO-kontroltabel: kontroluoverensstemmelse i sammentælling (intentional)', {
      source: 'Test page',
      page: 'Erstatningsopgørelse',
      tab: 'Kontroltabel',
      invariantId: 'control:sammentaelling_mismatch',
    });
    reportSystemIssue({
      code: 'control:sammentaelling_mismatch',
      area: 'eo',
      context: 'EOberegningTab',
      userMessage: 'Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
      revision: 'test-trigger',
      evidence: ['Ansættelsesforhold: beregnet=100, tabel=90'],
      diagnostics: {
        invariantId: 'control:sammentaelling_mismatch',
      },
    });
  }, []);

  return (
    <Box>

      <ContentBox className="content-box">
        <Typography className="section-header">Styled-komponenter</Typography>

        {/* StyledTextField */}
        <Box className="row--label-offset">
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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
          <Typography className="row--text" sx={{ minWidth: '250px' }}>
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

        <Typography className="row--subheading" sx={{ marginTop: 1 }}>
          Generelle devtools-hændelser
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Udløser en almindelig devtools-advarsel fra testsiden. Bruges til at kontrollere, at popupen åbner og kan skjules igen.
          </Typography>
          <Box className="row--label-right-hover__content">
            <Button variant="outlined" onClick={triggerDevtoolsWarning}>
              Udløs advarsel
            </Button>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Udløser en almindelig devtools-fejl fra testsiden. Bruges til at kontrollere det generelle fejlrapporteringsflow.
          </Typography>
          <Box className="row--label-right-hover__content">
            <Button variant="outlined" color="error" onClick={triggerDevtoolsError}>
              Udløs fejl
            </Button>
          </Box>
        </Box>

        <Typography className="row--subheading" sx={{ marginTop: 3 }}>
          Erstatningsopgørelse
        </Typography>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Simulerer fejlen fra siden Erstatningsopgørelse, fanen Beregning, hvor TAF fordelt på år ikke kan afstemmes inden for 1 kr. og derfor blokerer års-PDF’en.
          </Typography>
          <Box className="row--label-right-hover__content">
            <Button variant="outlined" color="error" onClick={triggerTafPerYearAfrundingError}>
              Udløs TAF-afvigelse
            </Button>
          </Box>
        </Box>

        <Box className="row--label-right-hover">
          <Typography className="row--text">
            Simulerer kontroluoverensstemmelse fra siden Erstatningsopgørelse, fanen Kontroltabel, hvor beregnet værdi og tabelværdi i sammentællingsboksen ikke stemmer.
          </Typography>
          <Box className="row--label-right-hover__content">
            <Button variant="outlined" color="error" onClick={triggerControlMismatchError}>
              Udløs sammentællingsfejl
            </Button>
          </Box>
        </Box>
      </ContentBox>

    </Box>
  );
});

StamdataTestTab.displayName = 'StamdataTestTab';

export default StamdataTestTab;
