import * as React from 'react';
import { Box, Tooltip } from '@mui/material';
import { ContentPasteGo } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../types/branded';
import { insertTodayDate } from '../../utils/insertTodayDate';

type InsertTodayDateButtonProps = Readonly<{
  onCommit: (today: ISODateString) => void;
  focusRef?: React.RefObject<HTMLInputElement | null>;
  tooltip?: string;
  sx?: SxProps<Theme>;
}>;

const InsertTodayDateButton = React.memo(
  ({ onCommit, focusRef, tooltip = 'Indsæt dags dato', sx }: InsertTodayDateButtonProps) => {
    const handleClick = React.useCallback(() => {
      insertTodayDate({
        onCommit,
        focusRef,
      });
    }, [focusRef, onCommit]);

    return (
      <Tooltip title={tooltip} arrow>
        <Box
          onClick={handleClick}
          tabIndex={-1}
          sx={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor: '#e3f2fd',
            },
            '&:active': {
              backgroundColor: '#bbdefb',
            },
            ...sx,
          }}
        >
          <ContentPasteGo
            sx={{
              fontSize: '24px',
              color: 'primary.main',
            }}
          />
        </Box>
      </Tooltip>
    );
  }
);

InsertTodayDateButton.displayName = 'InsertTodayDateButton';

export default InsertTodayDateButton;

