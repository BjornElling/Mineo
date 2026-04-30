import React from 'react';
import { Box, Typography } from '@mui/material';
import StyledAmountField from './StyledAmountField';
import type { CommitHandler } from '../../types/fieldEvents';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import type { FieldErrorReporter } from '../../types/fieldErrors';

type Props = Readonly<{
  label: string;
  name?: string;
  value: AmountValue | undefined;
  onCommit: CommitHandler<AmountValue | undefined>;
  errorMessage?: string;
  onFieldError?: FieldErrorReporter;
}>;

const AarsloenAmountFieldRow = ({ label, name, value, onCommit, errorMessage, onFieldError }: Props) => {
  return (
    <Box className="row--label-right-hover">
      <Typography className="row--text">{label}</Typography>
      <Box className="row--label-right-hover__content">
        <StyledAmountField
          name={name}
          value={value}
          onCommit={onCommit}
          allowNegative={false}
          allowDecimals={false}
          minValue={1000}
          maxValue={9999999}
          width={140}
          placeholder="0 kr."
          error={Boolean(errorMessage)}
          helperText={errorMessage ?? ''}
          onFieldError={onFieldError}
        />
      </Box>
    </Box>
  );
};

AarsloenAmountFieldRow.displayName = 'AarsloenAmountFieldRow';

export default AarsloenAmountFieldRow;
