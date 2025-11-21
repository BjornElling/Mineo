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
import { Download } from '@mui/icons-material';
import ContentBox from '../common/ContentBox';
import SectionHeader from '../common/SectionHeader';
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
import { calculateProcessInterest, formatAmount } from '../../utils/interestCalculator';
import { generateRentePdf } from '../../utils/pdf/rentePdf';
import { usePersistedForm } from '../../hooks/usePersistedForm';

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
  id: null, // Vil blive sat til et unikt ID når rækken oprettes
  belob: '',
  renterFra: '',
  tillaegstid: '',
  enhed: 'dage',
  enhedSelected: false, // Holder styr på om brugeren har aktivt valgt en enhed
};

// Hjælpefunktion til at tjekke om en række er tom
const isRowEmpty = (row) => {
  return !row.belob && !row.renterFra && !row.tillaegstid;
};

// Hjælpefunktion til at generere unikt ID
let rowIdCounter = 0;
const generateRowId = () => {
  rowIdCounter += 1;
  return `row_${Date.now()}_${rowIdCounter}`;
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
  try {
    const baseDate = parseDanishDate(rowValues.renterFra);
    if (!baseDate) {
      return null;
    }

    const tillaeg = Number.parseInt(rowValues.tillaegstid, 10);
    const extra = Number.isNaN(tillaeg) ? 0 : tillaeg;

    // Hvis brugeren ikke har valgt en enhed eller der er ingen tillægstid, brug bare basisdatoen
    if (!rowValues.enhedSelected || extra === 0) {
      return formatDanishDate(baseDate);
    }

    let result = baseDate;

    switch (rowValues.enhed) {
      case 'uger':
        result = addDays(baseDate, extra * 7);
        break;
      case 'maaneder':
        result = addMonths(baseDate, extra);
        break;
      case 'dage':
        result = addDays(baseDate, extra);
        break;
      default:
        result = baseDate;
        break;
    }

    return formatDanishDate(result);
  } catch (error) {
    console.error('Fejl ved beregning af rentedato:', error);
    return null;
  }
};

const technicalAssumptions = [
  'Rente beregnes i henhold til rentelovens § 5',
  'Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår)',
  'Beregningsdatoen indgår i renteberegningen',
  'Der beregnes ikke renters rente',
];

const Renteberegning = React.memo(() => {
  // Brug persisted form hook
  const { values: persistedValues, setValues: setPersistedValues } = usePersistedForm('renteberegning', {
    beregningsdato: '',
    rentekravRows: [{ ...rentekravInitialRow, id: generateRowId() }],
    activeTab: TAB_KEYS.CALCULATION,
  });

  const [activeTab, setActiveTab] = React.useState(persistedValues.activeTab || TAB_KEYS.CALCULATION);
  const [formValues, setFormValues] = React.useState(() => ({ beregningsdato: persistedValues.beregningsdato }));

  // Initialiser rows - hvis der ikke er nogen, opret en tom række
  const [rentekravRows, setRentekravRows] = React.useState(() => {
    const rows = persistedValues.rentekravRows;
    if (!rows || rows.length === 0) {
      return [{ ...rentekravInitialRow, id: generateRowId() }];
    }
    // Sørg for at alle rækker har et ID
    return rows.map(row => ({
      ...row,
      id: row.id || generateRowId()
    }));
  });

  // Committed værdier der kun opdateres ved onBlur
  const [committedFormValues, setCommittedFormValues] = React.useState(() => ({ beregningsdato: persistedValues.beregningsdato }));
  const [committedRentekravRows, setCommittedRentekravRows] = React.useState(() => {
    const rows = persistedValues.rentekravRows;
    if (!rows || rows.length === 0) {
      return [{ ...rentekravInitialRow, id: generateRowId() }];
    }
    return rows.map(row => ({
      ...row,
      id: row.id || generateRowId()
    }));
  });

  // Synkroniser med persistence når committed værdier ændres
  React.useEffect(() => {
    setPersistedValues({
      beregningsdato: committedFormValues.beregningsdato,
      rentekravRows: committedRentekravRows,
      activeTab: activeTab,
    });
  }, [committedFormValues, committedRentekravRows, activeTab, setPersistedValues]);

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

  const handleFieldBlur = React.useCallback(
    (fieldId) => (event) => {
      // Brug værdien fra event hvis den findes (efter auto-formatering), ellers fra formValues
      const valueToCommit = event?.target?.value ?? formValues[fieldId];
      setCommittedFormValues((prev) => ({ ...prev, [fieldId]: valueToCommit }));
    },
    [formValues]
  );

  // Funktion til automatisk håndtering af rækker
  const manageRows = React.useCallback((rows) => {
    let newRows = [...rows];

    // Fjern tomme rækker (bortset fra den sidste)
    newRows = newRows.filter((row, index) => {
      const isEmpty = isRowEmpty(row);
      const isLastRow = index === newRows.length - 1;
      return !isEmpty || isLastRow;
    });

    // Sørg for at der altid er mindst én række
    if (newRows.length === 0) {
      newRows = [{ ...rentekravInitialRow, id: generateRowId() }];
    }

    // Tjek om den sidste række er tom - hvis ikke, tilføj en ny tom række
    const lastRow = newRows[newRows.length - 1];
    if (!isRowEmpty(lastRow)) {
      newRows.push({ ...rentekravInitialRow, id: generateRowId() });
    }

    return newRows;
  }, []);

  const handleRentekravChange = React.useCallback(
    (rowId, fieldId) => (event) => {
      const value = event?.target?.value ?? '';

      setRentekravRows((prevRows) => {
        const newRows = prevRows.map((row) => {
          if (row.id !== rowId) return row;

          // Specialhåndtering for dropdown (enhed)
          if (fieldId === 'enhed') {
            return { ...row, [fieldId]: value, enhedSelected: true };
          }
          return { ...row, [fieldId]: value };
        });

        return newRows;
      });
    },
    []
  );

  const handleRentekravBlur = React.useCallback(
    (rowId, fieldId) => (event) => {
      // Brug værdien fra event hvis den findes (efter auto-formatering)
      const valueToCommit = event?.target?.value ?? '';

      // Opdater først rentekravRows med den formaterede værdi
      setRentekravRows((prevRows) => {
        const newRows = prevRows.map((row) => {
          if (row.id !== rowId) return row;

          const newValue = { ...row, [fieldId]: valueToCommit };

          // Hvis brugeren indtaster tillægstid, marker at enhed er valgt
          if (fieldId === 'tillaegstid' && valueToCommit && parseInt(valueToCommit, 10) > 0) {
            newValue.enhedSelected = true;
          }

          return newValue;
        });

        // Kør row management på de opdaterede rows
        const managedRows = manageRows(newRows);

        // Derefter commit værdien (via setTimeout for at sikre state er opdateret)
        setTimeout(() => {
          setCommittedRentekravRows(managedRows);
        }, 0);

        return managedRows;
      });
    },
    [manageRows]
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
          onFieldBlur={handleFieldBlur}
          rentekravRows={rentekravRows}
          onRentekravChange={handleRentekravChange}
          onRentekravBlur={handleRentekravBlur}
          committedFormValues={committedFormValues}
          committedRentekravRows={committedRentekravRows}
        />
      )}
    </Box>
  );
});

const RatesTabContent = React.memo(() => (
  <Box>
    <ContentBox>
      <SectionHeader>Referencesats</SectionHeader>
      <Typography>
        Nationalbankens udlånsrente pr. 1. januar og 1. juli, jf. rentelovens § 5.
      </Typography>
      <InterestRatesTable rows={referenceRates} />
    </ContentBox>

    <ContentBox>
      <SectionHeader>Tillægssats</SectionHeader>
      <Typography>
        Fast tillægsprocent, der tilskrives udlånsrenten, jf. rentelovens § 5, stk. 2.
      </Typography>
      <InterestRatesTable rows={surchargeRates} dateColumnHeader="Forfaldsdato" rateColumnHeader="Sats" />
    </ContentBox>
  </Box>
));

const CalculationTabContent = React.memo(({
  formValues,
  onFieldChange,
  onFieldBlur,
  rentekravRows,
  onRentekravChange,
  onRentekravBlur,
  committedFormValues,
  committedRentekravRows
}) => (
  <Box>
    {calculationSections.map((section) => (
      <ContentBox key={section.key}>
        <SectionHeader>{section.title}</SectionHeader>
        {section.description && <Typography>{section.description}</Typography>}
        {section.fields.map((field) => (
          <FieldRow key={field.id} label={field.label}>
            {renderFieldInput({
              field,
              value: formValues[field.id],
              onChange: onFieldChange(field.id),
              onBlur: onFieldBlur(field.id),
            })}
          </FieldRow>
        ))}
      </ContentBox>
    ))}

    <BeregnetRenteSection
      rows={rentekravRows}
      onRowChange={onRentekravChange}
      onRowBlur={onRentekravBlur}
      beregningsdato={committedFormValues.beregningsdato}
      committedRows={committedRentekravRows}
    />

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

const renderFieldInput = ({ field, value, onChange, onBlur }) => {
  if (field.type === 'date') {
    return (
      <StyledDateField
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        minDate={field.minDate}
        maxDate={field.maxDate}
      />
    );
  }

  if (field.type === 'dropdown') {
    return (
      <StyledDropdown value={value} onChange={onChange} onBlur={onBlur} width={field.width} placeholder={field.placeholder}>
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
        onBlur={onBlur}
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
        onBlur={onBlur}
        width={field.width}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <StyledTextField
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      width={field.width}
      placeholder={field.placeholder}
    />
  );
};

const BeregnetRenteSection = ({ rows, onRowChange, onRowBlur, beregningsdato, committedRows }) => (
  <ContentBox>
    <SectionHeader>Beregnet rente</SectionHeader>
    <BeregnetRenteTable
      rows={rows}
      onRowChange={onRowChange}
      onRowBlur={onRowBlur}
      beregningsdato={beregningsdato}
      committedRows={committedRows}
    />
  </ContentBox>
);

// =======================================================================
// BeregnetRenteTable – dropdown 10px smallere, specifikation 10px bredere
// =======================================================================

const BeregnetRenteTable = ({ rows, onRowChange, onRowBlur, beregningsdato, committedRows }) => {
  return (
    <Table
      size="small"
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        overflow: 'hidden',
        tableLayout: 'fixed',
        width: '930px',
        '& .MuiTableCell-root': {
          fontSize: (theme) => theme.typography.body1.fontSize,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        },
        '& thead th': {
          backgroundColor: '#f8fafc',
          fontWeight: (theme) => theme.typography.h6.fontWeight,
        },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: '140px' }}>Beløb</TableCell>
          <TableCell sx={{ width: '130px' }}>Renter fra</TableCell>
          <TableCell sx={{ width: '250px' }}>Evt. tillægstid</TableCell>
          <TableCell sx={{ width: '130px' }}>Rentedato</TableCell>
          <TableCell sx={{ width: '120px' }}>Beregnet rente</TableCell>
          <TableCell sx={{ width: '130px' }}>Specifikation</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {rows.map((row) => (
          <BeregnetRenteRow
            key={row.id}
            row={row}
            committedRow={committedRows.find((r) => r.id === row.id) || row}
            onRowChange={onRowChange}
            onRowBlur={onRowBlur}
            beregningsdato={beregningsdato}
          />
        ))}
      </TableBody>
    </Table>
  );
};

const BeregnetRenteRow = ({ row, committedRow, onRowChange, onRowBlur, beregningsdato }) => {
  // Beregn dynamisk maxDate for "Renter fra" baseret på beregningsdato
  const dynamicMaxDate = React.useMemo(() => {
    // Hvis beregningsdato er tom eller ugyldig, brug standard max-dato
    if (!beregningsdato || typeof beregningsdato !== 'string') {
      return `${MAX_CALCULATION_YEAR}-12-31`;
    }

    // Parse beregningsdato (dd-mm-åååå) til ISO format (åååå-mm-dd)
    const parts = beregningsdato.split('-');
    if (parts.length !== 3) {
      return `${MAX_CALCULATION_YEAR}-12-31`;
    }

    const [day, month, year] = parts;

    // Valider at vi har gyldige dele
    if (!day || !month || !year || year.length !== 4) {
      return `${MAX_CALCULATION_YEAR}-12-31`;
    }

    // Konverter til ISO format
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Tjek om denne dato er før standard max-dato
    const beregningsDatoObj = new Date(isoDate);
    const standardMaxDatoObj = new Date(`${MAX_CALCULATION_YEAR}-12-31`);

    // Returner den mindste af de to datoer
    return beregningsDatoObj < standardMaxDatoObj ? isoDate : `${MAX_CALCULATION_YEAR}-12-31`;
  }, [beregningsdato]);

  // Beregn rentedato baseret på COMMITTED værdier
  const actualInterestDate = React.useMemo(
    () => calculateActualInterestDate(committedRow),
    [committedRow]
  );

  // Beregn renten baseret på COMMITTED værdier
  const calculatedInterest = React.useMemo(() => {
    if (!committedRow.belob || !actualInterestDate || !beregningsdato) {
      return null;
    }

    try {
      return calculateProcessInterest(committedRow.belob, actualInterestDate, beregningsdato);
    } catch (error) {
      console.error('Fejl ved renteberegning:', error);
      return null;
    }
  }, [committedRow.belob, actualInterestDate, beregningsdato]);

  return (
    <TableRow>
      {/* Beløb */}
      <TableCell>
        <StyledAmountField
          value={row.belob}
          onChange={onRowChange(row.id, 'belob')}
          onBlur={onRowBlur(row.id, 'belob')}
          width={120}
          placeholder="0,00 kr."
        />
      </TableCell>

      {/* Renter fra */}
      <TableCell>
        <StyledDateField
          value={row.renterFra}
          onChange={onRowChange(row.id, 'renterFra')}
          onBlur={onRowBlur(row.id, 'renterFra')}
          minDate={MIN_CALCULATION_DATE}
          maxDate={dynamicMaxDate}
        />
      </TableCell>

      {/* Evt. tillægstid */}
      <TableCell>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>+</Typography>

          <StyledIntegerField
            value={row.tillaegstid}
            onChange={onRowChange(row.id, 'tillaegstid')}
            onBlur={onRowBlur(row.id, 'tillaegstid')}
            width={50}
            placeholder="0"
            minValue={0}
            maxValue={99}
          />

          <StyledDropdown
            value={row.enhed}
            onChange={onRowChange(row.id, 'enhed')}
            onBlur={onRowBlur(row.id, 'enhed')}
            width={140}
            sx={{
              '& .MuiSelect-select': { textAlign: 'left' },
            }}
          >
            {ENHED_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </StyledDropdown>
        </Box>
      </TableCell>

      {/* Rentedato (beregnes fra committed værdier) */}
      <TableCell>
        <Typography sx={{ color: 'var(--color-text-secondary)' }}>
          {actualInterestDate || '--'}
        </Typography>
      </TableCell>

      {/* Beregnet rente */}
      <TableCell>
        <Typography sx={{ color: 'var(--color-text-secondary)' }}>
          {calculatedInterest !== null ? `${formatAmount(calculatedInterest)} kr.` : '0,00 kr.'}
        </Typography>
      </TableCell>

      {/* Specifikation */}
      <TableCell>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {calculatedInterest !== null ? (
            <Box
              onClick={() => {
                // Generer PDF-specifikation
                const actualDate = calculateActualInterestDate(committedRow);
                if (committedRow.belob && actualDate && beregningsdato) {
                  generateRentePdf(committedRow.belob, actualDate, beregningsdato);
                }
              }}
              tabIndex={-1}
              sx={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                '&:hover': {
                  backgroundColor: '#e3f2fd',
                },
                '&:active': {
                  backgroundColor: '#bbdefb',
                },
              }}
            >
              <Download
                sx={{
                  fontSize: '24px',
                  color: '#1976d2',
                }}
              />
            </Box>
          ) : (
            <Typography sx={{ color: 'var(--color-text-secondary)' }}>
              -
            </Typography>
          )}
        </Box>
      </TableCell>
    </TableRow>
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

const InterestRatesTable = ({ rows, dateColumnHeader = 'Rentedato', rateColumnHeader = 'Sats' }) => (
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
          fontSize: (theme) => theme.typography.body1.fontSize,
        },
        '& thead th': {
          backgroundColor: '#f8fafc',
          fontWeight: (theme) => theme.typography.h6.fontWeight,
          borderBottom: '1px solid #e5e7eb !important',
        },
        '& tbody tr:nth-of-type(odd)': {
          backgroundColor: '#f9fafb',
        },
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>{dateColumnHeader}</TableCell>
          <TableCell align="right" sx={{ paddingRight: '60px !important' }}>
            {rateColumnHeader}
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
