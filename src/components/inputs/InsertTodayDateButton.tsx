import * as React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { ContentPasteGo } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../types/branded';
import { insertTodayDate } from '../../utils/insertTodayDate';
import { mergeSx } from '../../utils/mergeSx';

type InsertTodayDateButtonProps = Readonly<{
  onCommit: (today: ISODateString) => void;
  tooltip?: string;
  sx?: SxProps<Theme>;
}>;

const InsertTodayDateButton = React.memo(
  ({ onCommit, tooltip = 'Indsæt dags dato', sx }: InsertTodayDateButtonProps) => {
    const handleClick = React.useCallback(() => {
      insertTodayDate({ onCommit });
    }, [onCommit]);

    return (
      <Tooltip title={tooltip} arrow>
        <IconButton
          type="button"
          aria-label={tooltip}
          data-mineo-focusable-button="true"
          onClick={handleClick}
          sx={mergeSx({
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor: 'var(--color-icon-action-hover)',
            },
            '&:active': {
              backgroundColor: 'var(--color-icon-action-active)',
            },
          }, sx)}
        >
          <ContentPasteGo
            sx={{
              fontSize: '24px',
              color: 'primary.main',
            }}
          />
        </IconButton>
      </Tooltip>
    );
  }
);

InsertTodayDateButton.displayName = 'InsertTodayDateButton';

export default InsertTodayDateButton;
