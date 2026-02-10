import React from 'react';
import { Box, Typography } from '@mui/material';
import { MIN_CALCULATION_DATE, MAX_CALCULATION_YEAR } from '../../../data/interestRates';
import StyledDateField from '../../inputs/StyledDateField';
import InsertTodayDateButton from '../../inputs/InsertTodayDateButton';
import { toISODateString } from '../../../types/branded';
import BeregnetRenteTable from '../../tables/BeregnetRenteTable';
import ContentBox from '../../layout/ContentBox';
import type { RentekravRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { RentekravDraftRow } from '../../../domain/renteberegning/tableDraftRows';

const technicalAssumptions = [
  'Rente beregnes i henhold til rentelovens § 5',
  'Som beregningsprincip anvendes 365 årlige rentedage (366 i skudår)',
  'Beregningsdatoen indgår i renteberegningen',
  'Der beregnes ikke renters rente',
];

interface TechnicalAssumptionsListProps {
  items: string[];
}

const TechnicalAssumptionsList = ({ items }: TechnicalAssumptionsListProps) => (
  <Box component="ul" sx={{ margin: 0, paddingLeft: '20px', color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
    {items.map((item) => (
      <Typography className="row--text" component="li" key={item} sx={{ marginBottom: '8px' }}>
        {item}
      </Typography>
    ))}
  </Box>
);

export interface RenteberegningTabProps {
  beregningsdato: ISODateString | undefined;
  onBeregningsdatoChange: (event: { target: { value: unknown } }) => void;
  rentekravRows: RentekravDraftRow[];
  onRentekravChange: (rowId: string, fieldId: 'belob' | 'renterFra' | 'tillaegstid' | 'enhed') => (value: string) => void;
  onRentekravBlur: (rowId: string) => void;
  committedRentekravById: ReadonlyMap<string, RentekravRow>;
  onError: (message: string, context: string, error?: unknown) => void;
}

const RenteberegningTab = React.memo(({
  beregningsdato,
  onBeregningsdatoChange,
  rentekravRows,
  onRentekravChange,
  onRentekravBlur,
  committedRentekravById,
  onError,
}: RenteberegningTabProps) => {
  const [beregningsdatoHasError, setBeregningsdatoHasError] = React.useState(false);

  return (
    <Box>
      <ContentBox className="content-box">
        <Typography className="section-header">Beregningsdato</Typography>
        <Box className="row--label-offset">
          <Typography className="row--text">Rente beregnes til og med</Typography>
          <Box className="row--label-offset__content">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledDateField
                value={beregningsdato}
                onCommit={onBeregningsdatoChange}
                minDate={toISODateString(MIN_CALCULATION_DATE)}
                maxDate={toISODateString(`${MAX_CALCULATION_YEAR}-12-31`)}
                onFieldError={(errorMsg) => setBeregningsdatoHasError(!!errorMsg)}
              />
              <InsertTodayDateButton
                onCommit={(today) => {
                  onBeregningsdatoChange({ target: { value: today } });
                }}
              />
            </Box>
          </Box>
        </Box>
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregnet rente</Typography>
        <BeregnetRenteTable
          rows={rentekravRows}
          onFieldChange={onRentekravChange}
          onRowBlur={onRentekravBlur}
          beregningsdato={beregningsdato}
          committedById={committedRentekravById}
          onError={onError}
          beregningsdatoHasError={beregningsdatoHasError}
        />
      </ContentBox>

      <ContentBox className="content-box">
        <Typography className="section-header">Beregningstekniske forudsætninger</Typography>
        <TechnicalAssumptionsList items={technicalAssumptions} />
      </ContentBox>
    </Box>
  );
});

RenteberegningTab.displayName = 'RenteberegningTab';

export default RenteberegningTab;
