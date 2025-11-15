import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
} from '@mui/material';
import ContentBox from '../common/ContentBox';
import {
  referenceRates,
  surchargeRates,
  MIN_CALCULATION_DATE,
  MAX_CALCULATION_YEAR,
} from '../../data/interestRates';
import StyledDateField from '../inputs/StyledDateField';
import StyledTextField from '../inputs/StyledTextField';
import StyledDropdown from '../inputs/StyledDropdown';
import StyledIntegerField from '../inputs/StyledIntegerField';
import StyledAmountField from '../inputs/StyledAmountField';

const TAB_KEYS = {
  RATES: 'rates',
  CALCULATION: 'calculation',
};

const ENHED_OPTIONS = [
  { value: 'dage', label: 'Dage' },
  { value: 'maaneder', label: 'Måneder' },
  { value: 'aar', label: 'År' },
];

const calculationSections = [
  {
    key: 'beregningsdato',
    title: 'Beregningsdato',
    fields: [
      {
        id: 'beregningsdato',
        label: 'Rente beregnes til og med',
        type: 'date',
        width: 160,
        minDate: MIN_CALCULATION_DATE,
        maxDate: `${MAX_CALCULATION_YEAR}-12-31`,
      },
      {
        id: 'testInteger',
        label: 'Test heltal (1-100)',
        type: 'integer',
        width: 120,
        minValue: 1,
        maxValue: 100,
      },
      {
        id: 'testAmount',
        label: 'Test beløb',
        type: 'amount',
        width: 160,
      },
    ],
  },
  {
    key: 'rentekrav',
    title: 'Rentekrav',
    description:
      'Disse felter kommer til at svare til rentekrav-tabellen i det tidligere projekt. Indtastningerne er endnu ikke aktive.',
    fields: [
      { id: 'belob', label: 'Beløb', type: 'text', width: 240, placeholder: 'fx 75.000 kr.' },
      { id: 'periodestart', label: 'Periodestart', type: 'date', width: 160 },
      { id: 'periodeslut', label: 'Periodeslut', type: 'date', width: 160 },
      { id: 'tillaegstid', label: 'Tillægstid (mdr.)', type: 'text', width: 140, placeholder: 'fx 3' },
      {
        id: 'enhed',
        label: 'Enhed',
        type: 'dropdown',
        width: 200,
        placeholder: 'Vælg enhed',
        options: ENHED_OPTIONS,
      },
    ],
  },
];

const technicalAssumptions = [
  'Rente beregnes i henhold til rentelovens § 5',
  'Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår)',
  'Beregningsdatoen indgår i renteberegningen',
  'Der beregnes ikke renters rente',
];

const createInitialFormValues = () => {
  const defaults = {};
  calculationSections.forEach((section) => {
    section.fields.forEach((field) => {
      defaults[field.id] = '';
    });
  });
  return defaults;
};

const Renteberegning = React.memo(() => {
  const [activeTab, setActiveTab] = React.useState(TAB_KEYS.CALCULATION);
  const [formValues, setFormValues] = React.useState(() => createInitialFormValues());

  const handleTabChange = React.useCallback((_, value) => {
    setActiveTab(value);
  }, []);

  const handleFieldChange = React.useCallback(
    (fieldId) => (event) => {
      const value = event?.target?.value ?? '';
      setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    },
    []
  );

  return (
    <Box>
      <Typography variant="h4" className="page-title">
        Renteberegning
      </Typography>

      <Box
        sx={{
          position: 'relative',
          width: '1000px',
          height: 0,
          mb: '40px',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-48px',
            right: '20px',
            zIndex: 10,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 140,
                transition: 'color 0.2s, opacity 0.2s',
                opacity: 0.7,
                '&:hover': {
                  opacity: 1,
                },
                '&.Mui-selected': {
                  color: '#1976d2',
                  opacity: 1,
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#1976d2',
                height: '2px',
              },
            }}
          >
            <Tab label="Beregning" value={TAB_KEYS.CALCULATION} />
            <Tab label="Rentesatser" value={TAB_KEYS.RATES} />
          </Tabs>
        </Box>
      </Box>

      {activeTab === TAB_KEYS.RATES ? (
        <RatesTabContent />
      ) : (
        <CalculationTabContent formValues={formValues} onFieldChange={handleFieldChange} />
      )}
    </Box>
  );
});

const SectionHeader = ({ children }) => (
  <Typography className="section-header" component="div">
    {children}
  </Typography>
);

const SectionDescription = ({ children }) => (
  <Typography className="body-text-secondary" sx={{ marginBottom: '24px' }}>
    {children}
  </Typography>
);

const RatesTabContent = React.memo(() => (
  <Box>
    <ContentBox>
      <SectionHeader>Referencesats</SectionHeader>
      <SectionDescription>
        Nationalbankens udlånsrente pr. 1. januar og 1. juli, jf. rentelovens § 5.
      </SectionDescription>
      <InterestRatesTable rows={referenceRates} />
    </ContentBox>

    <ContentBox>
      <SectionHeader>Tillægssats</SectionHeader>
      <SectionDescription>
        Fast tillægsprocent, der tilskrives udlånsrenten, jf. rentelovens § 5, stk. 2.
      </SectionDescription>
      <InterestRatesTable rows={surchargeRates} />
    </ContentBox>
  </Box>
));

const CalculationTabContent = React.memo(({ formValues, onFieldChange }) => (
  <Box>
    {calculationSections.map((section) => (
      <ContentBox key={section.key}>
        <SectionHeader>{section.title}</SectionHeader>
        <SectionDescription>{section.description}</SectionDescription>
        {section.fields.map((field) => (
          <FieldRow key={field.id} label={field.label}>
            {renderFieldInput({
              field,
              value: formValues[field.id],
              onChange: onFieldChange(field.id),
            })}
          </FieldRow>
        ))}
      </ContentBox>
    ))}

    <ContentBox>
      <SectionHeader>Beregningstekniske forudsætninger</SectionHeader>
      <TechnicalAssumptionsList items={technicalAssumptions} />
    </ContentBox>
  </Box>
));

const FieldRow = ({ label, children }) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 2,
      marginBottom: '16px',
      alignItems: 'flex-start',
    }}
  >
    <Typography className="field-label" sx={{ minWidth: '200px' }}>
      {label}:
    </Typography>
    <Box sx={{ flex: 1, minWidth: '220px' }}>{children}</Box>
  </Box>
);

const renderFieldInput = ({ field, value, onChange }) => {
  if (field.type === 'date') {
    return (
      <StyledDateField
        value={value}
        onChange={onChange}
        width={field.width}
        placeholder={field.placeholder || 'dd-mm-åååå'}
        minDate={field.minDate}
        maxDate={field.maxDate}
      />
    );
  }

  if (field.type === 'integer') {
    return (
      <StyledIntegerField
        value={value}
        onChange={onChange}
        width={field.width}
        placeholder={field.placeholder}
        minValue={field.minValue}
        maxValue={field.maxValue}
      />
    );
  }

  if (field.type === 'amount') {
    return (
      <StyledAmountField
        value={value}
        onChange={onChange}
        width={field.width}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'dropdown') {
    return (
      <StyledDropdown value={value} onChange={onChange} width={field.width} placeholder={field.placeholder}>
        {field.options?.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </StyledDropdown>
    );
  }

  return (
    <StyledTextField
      value={value}
      onChange={onChange}
      width={field.width}
      placeholder={field.placeholder}
      multiline={field.multiline}
      minRows={field.minRows}
    />
  );
};

const TechnicalAssumptionsList = ({ items }) => (
  <Box
    component="ul"
    sx={{
      margin: 0,
      paddingLeft: '20px',
      color: 'var(--color-text-primary)',
      fontSize: '16px',
      lineHeight: 1.6,
    }}
  >
    {items.map((item) => (
      <Box component="li" key={item} sx={{ marginBottom: '8px' }}>
        {item}
      </Box>
    ))}
  </Box>
);

const InterestRatesTable = ({ rows }) => (
  <Box
    sx={{
      mt: 3,
      maxWidth: '400px',
    }}
  >
    <Table
      size="small"
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        overflow: 'hidden',
        '& .MuiTableCell-root': {
          border: 'none',
          paddingLeft: '50px',
          paddingRight: '50px',
        },
        '& thead th': {
          backgroundColor: '#f8fafc',
          fontWeight: 600,
          borderBottom: '1px solid #e5e7eb !important',
        },
        '& tbody tr:nth-of-type(odd)': {
          backgroundColor: '#f9fafb',
        },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>Rentedato</TableCell>
          <TableCell align="right" sx={{ paddingRight: '60px !important' }}>Sats</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.effectiveDate}-${row.rate}`}>
            <TableCell>{row.effectiveDate}</TableCell>
            <TableCell align="right">{row.rate.replace('-', '− ')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);

Renteberegning.displayName = 'Renteberegning';
RatesTabContent.displayName = 'RatesTabContent';
CalculationTabContent.displayName = 'CalculationTabContent';

export default Renteberegning;
