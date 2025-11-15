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
  { value: 'uger', label: 'Uger' },
  { value: 'maaneder', label: 'Måneder' },
];

const calculationSections = [
  {
    key: 'beregningsdato',
    title: 'Beregningsdato',
    description: 'Angiv hvilken dato renten skal beregnes til.',
    fields: [
      {
        id: 'beregningsdato',
        label: 'Rente beregnes til og med',
        type: 'date',
        width: 180,
        minDate: MIN_CALCULATION_DATE,
        maxDate: `${MAX_CALCULATION_YEAR}-12-31`,
      },
    ],
  },
];

const rentekravInitialRow = {
  belob: '',
  renterFra: '',
  tillaegstid: '',
  enhed: 'dage',
};

const createDate = (year, monthIndex, day) => {
  const date = new Date(year, monthIndex, day);
  date.setFullYear(year);
  return date;
};

const parseDanishDate = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length < 1 || monthStr.length < 1 || yearStr.length !== 4) {
    return null;
  }

  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const date = createDate(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

const addDays = (date, days) => {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
};

const addMonths = (date, months) => {
  if (!months) {
    return new Date(date.getTime());
  }

  const day = date.getDate();
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const result = createDate(targetYear, normalizedMonth, 1);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));

  return result;
};

const formatDanishDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const calculateActualInterestDate = (rowValues) => {
  const baseDate = parseDanishDate(rowValues.renterFra);
  if (!baseDate) {
    return null;
  }

  const tillaeg = Number.parseInt(rowValues.tillaegstid, 10);
  const extra = Number.isNaN(tillaeg) ? 0 : tillaeg;
  let result = baseDate;

  switch (rowValues.enhed) {
    case 'uger':
      result = addDays(baseDate, extra * 7);
      break;
    case 'maaneder':
      result = addMonths(baseDate, extra);
      break;
    case 'dage':
    default:
      result = addDays(baseDate, extra);
      break;
  }

  return formatDanishDate(result);
};

const technicalAssumptions = [
  'Rente beregnes i henhold til rentelovens § 5',
  'Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår)',
  'Beregningsdatoen indgår i renteberegningen',
  'Der beregnes ikke renters rente',
];

const Renteberegning = React.memo(() => {
  const [activeTab, setActiveTab] = React.useState(TAB_KEYS.CALCULATION);
  const [formValues, setFormValues] = React.useState(() => ({ beregningsdato: '' }));
  const [rentekravRow, setRentekravRow] = React.useState(() => ({ ...rentekravInitialRow }));

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

  const handleRentekravChange = React.useCallback(
    (fieldId) => (event) => {
      const value = event?.target?.value ?? '';
      setRentekravRow((prev) => ({ ...prev, [fieldId]: value }));
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
        <CalculationTabContent
          formValues={formValues}
          onFieldChange={handleFieldChange}
          rentekravRow={rentekravRow}
          onRentekravChange={handleRentekravChange}
        />
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

const CalculationTabContent = React.memo(({ formValues, onFieldChange, rentekravRow, onRentekravChange }) => (
  <Box>
    {calculationSections.map((section) => (
      <ContentBox key={section.key}>
        <SectionHeader>{section.title}</SectionHeader>
        {section.description && <SectionDescription>{section.description}</SectionDescription>}
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

    <BeregnetRenteSection rowValues={rentekravRow} onRowChange={onRentekravChange} />

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
        minDate={field.minDate}
        maxDate={field.maxDate}
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

  return (
    <StyledTextField
      value={value}
      onChange={onChange}
      width={field.width}
      placeholder={field.placeholder}
    />
  );
};

const BeregnetRenteSection = ({ rowValues, onRowChange }) => (
  <ContentBox>
    <SectionHeader>Beregnet rente</SectionHeader>
    <BeregnetRenteTable rowValues={rowValues} onRowChange={onRowChange} />
  </ContentBox>
);

// =======================================================================
// BeregnetRenteTable – RENSKRIVET SOM ÆGTE TABEL
// Brug af MUI Table, TableRow og TableCell
// Tillægstid ligger i én celle med flex layout
// =======================================================================

const BeregnetRenteTable = ({ rowValues, onRowChange }) => {
  const actualInterestDate = React.useMemo(
    () => calculateActualInterestDate(rowValues),
    [rowValues]
  );

  return (
    <Table
      size="small"
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        overflow: 'hidden',
        '& .MuiTableCell-root': {
          fontSize: '0.9rem',
          textAlign: 'center',
        },
        '& thead th': {
          backgroundColor: '#f8fafc',
          fontWeight: 600,
          borderBottom: '1px solid #e5e7eb !important',
        },
      }}
    >
      {/* ------------------------------------------------------------
         Tabel-header
      ------------------------------------------------------------ */}
      <TableHead>
        <TableRow>
          <TableCell>Fordring</TableCell>
          <TableCell>Beløb</TableCell>
          <TableCell>Renter fra</TableCell>
          <TableCell>Evt. tillægstid</TableCell>
          <TableCell>Rentedato</TableCell>
          <TableCell>Beregnet rente</TableCell>
          <TableCell>Specifikation</TableCell>
        </TableRow>
      </TableHead>

      {/* ------------------------------------------------------------
         Data-rækken (1 fordring)
      ------------------------------------------------------------ */}
      <TableBody>
        <TableRow>
          {/* Fordringsnummer */}
          <TableCell>
            <Typography sx={{ fontWeight: 600 }}>1</Typography>
          </TableCell>

          {/* Beløb */}
          <TableCell>
            <StyledAmountField
              value={rowValues.belob}
              onChange={onRowChange('belob')}
              width={130}
              placeholder="0,00 kr."
            />
          </TableCell>

          {/* Renter fra */}
          <TableCell>
            <StyledDateField
              value={rowValues.renterFra}
              onChange={onRowChange('renterFra')}
              minDate={MIN_CALCULATION_DATE}
              maxDate={`${MAX_CALCULATION_YEAR}-12-31`}
            />
          </TableCell>

          {/* Evt. tillægstid – NOTE: én celle med flex layout */}
          <TableCell>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontWeight: 600 }}>+</Typography>

              <StyledIntegerField
                value={rowValues.tillaegstid}
                onChange={onRowChange('tillaegstid')}
                width={48}
                placeholder="0"
                minValue={0}
                maxValue={99}
              />

              <StyledDropdown
                value={rowValues.enhed}
                onChange={onRowChange('enhed')}
                width={130}
              >
                {ENHED_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </StyledDropdown>
            </Box>
          </TableCell>

          {/* Rentedato */}
          <TableCell>
            <Typography sx={{ color: 'var(--color-text-secondary)' }}>
              {actualInterestDate || '--'}
            </Typography>
          </TableCell>

          {/* Beregnet rente */}
          <TableCell>
            <Typography sx={{ color: 'var(--color-text-secondary)' }}>
              0,00 kr.
            </Typography>
          </TableCell>

          {/* Specifikation */}
          <TableCell>
            <Typography sx={{ color: 'var(--color-text-secondary)' }}>
              -
            </Typography>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
};

const TechnicalAssumptionsList = ({ items }) => (
  <Box component="ul" sx={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
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
          <TableCell align="right" sx={{ paddingRight: '60px !important' }}>
            Sats
          </TableCell>
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













