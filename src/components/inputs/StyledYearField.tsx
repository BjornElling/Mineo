import * as React from 'react';
import StyledYearFieldNext from './StyledYearFieldNext';
import type { CommitEvent } from './fieldEvents';

export type StyledYearFieldValueChangeEvent = CommitEvent<number | undefined>;

export type StyledYearFieldProps = Omit<React.ComponentProps<typeof StyledYearFieldNext>, 'externalError'> & {
  error?: boolean;
  helperText?: string;
};

/**
 * Legacy wrapper for `StyledYearFieldNext`.
 *
 * This component must remain a pure pass-through to avoid API drift.
 * Do not extend this wrapper; extend `StyledYearFieldNext` instead.
 */
const StyledYearField = React.forwardRef<HTMLDivElement, StyledYearFieldProps>(
  ({ error = false, helperText = '', ...rest }, ref) => {
    return (
      <StyledYearFieldNext
        ref={ref}
        {...rest}
        externalError={error ? { message: helperText } : undefined}
      />
    );
  }
);

StyledYearField.displayName = 'StyledYearField';

export default StyledYearField;
